[CmdletBinding()]
param(
    [string]$Server = '82.29.170.11',
    [string]$AdminUser = 'root',
    [string]$OpsUser = 'iceforge-ops',
    [string]$PublicKeyFile = "$env:USERPROFILE\.ssh\iceforge_ops_ed25519.pub",
    [string]$PrivateKeyFile = "$env:USERPROFILE\.ssh\iceforge_ops_ed25519",
    [datetime]$ExpiresOn = (Get-Date).Date.AddDays(7),
    [string]$AdminIdentityFile
)

$ErrorActionPreference = 'Stop'

foreach ($command in @('ssh')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Commande introuvable: $command"
    }
}

foreach ($path in @($PublicKeyFile, $PrivateKeyFile)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Fichier introuvable: $path"
    }
}

$PublicKeyFile = (Resolve-Path -LiteralPath $PublicKeyFile).Path
$PrivateKeyFile = (Resolve-Path -LiteralPath $PrivateKeyFile).Path

if ($AdminIdentityFile) {
    if (-not (Test-Path -LiteralPath $AdminIdentityFile -PathType Leaf)) {
        throw "Cle administrateur introuvable: $AdminIdentityFile"
    }
    $AdminIdentityFile = (Resolve-Path -LiteralPath $AdminIdentityFile).Path
}

$publicKey = (Get-Content -LiteralPath $PublicKeyFile -Raw).Trim()
if ($publicKey -notmatch '^ssh-ed25519 [A-Za-z0-9+/]+={0,3}(?: [A-Za-z0-9@._+:-]+)?$') {
    throw 'La cle publique doit etre une cle OpenSSH ssh-ed25519 valide.'
}

$keyParts = $publicKey -split ' ', 3
$keyBlob = $keyParts[1]
$expiryDate = $ExpiresOn.ToString('yyyy-MM-dd')
$expiryTimestamp = $ExpiresOn.ToString('yyyyMMdd') + '235959'

# These values have deliberately narrow character sets before being embedded in Bash.
foreach ($value in @($OpsUser, $keyBlob, $expiryDate, $expiryTimestamp)) {
    if ($value -notmatch '^[A-Za-z0-9+/=._-]+$') {
        throw "Valeur non sure pour la commande distante: $value"
    }
}

$remoteScript = @"
set -euo pipefail

ops_user='$OpsUser'
key_blob='$keyBlob'
public_key='$publicKey'
expiry_date='$expiryDate'
expiry_timestamp='$expiryTimestamp'

if ! getent passwd "`$ops_user" >/dev/null; then
    echo "Compte inexistant: `$ops_user" >&2
    exit 20
fi

ops_home="`$(getent passwd "`$ops_user" | cut -d: -f6)"
ops_group="`$(id -gn "`$ops_user")"
client_addr="`${SSH_CONNECTION%% *}"
server_host="`$(hostname -f 2>/dev/null || hostname)"
authorized_keys_specs='.ssh/authorized_keys'
if command -v sshd >/dev/null; then
    effective_specs="`$(sshd -T -C "user=`$ops_user,host=`$server_host,addr=`$client_addr" 2>/dev/null |
        awk '`$1 == "authorizedkeysfile" { for (i = 2; i <= NF; i++) printf "%s ", `$i }')"
    if [ -n "`$effective_specs" ]; then
        authorized_keys_specs="`$effective_specs"
    fi
fi

authorized_keys=''
first_authorized_keys=''
for spec in `$authorized_keys_specs; do
    [ "`$spec" = 'none' ] && continue
    candidate="`${spec//%h/`$ops_home}"
    candidate="`${candidate//%u/`$ops_user}"
    candidate="`${candidate//%%/%}"
    if [[ "`$candidate" != /* ]]; then
        candidate="`$ops_home/`$candidate"
    fi
    [ -z "`$first_authorized_keys" ] && first_authorized_keys="`$candidate"
    if [ -f "`$candidate" ] && grep -Fq "`$key_blob" "`$candidate"; then
        authorized_keys="`$candidate"
        break
    fi
done

[ -z "`$authorized_keys" ] && authorized_keys="`$first_authorized_keys"
if [ -z "`$authorized_keys" ]; then
    echo 'sshd n’autorise aucun fichier authorized_keys pour ce compte.' >&2
    exit 21
fi

ssh_dir="`$(dirname "`$authorized_keys")"
if [[ "`$ssh_dir" == "`$ops_home"* ]]; then
    install -d -o "`$ops_user" -g "`$ops_group" -m 700 "`$ssh_dir"
else
    install -d -o root -g root -m 755 "`$ssh_dir"
fi

if [ -e "`$authorized_keys" ]; then
    file_owner="`$(stat -c '%U' "`$authorized_keys")"
    file_group="`$(stat -c '%G' "`$authorized_keys")"
    file_mode="`$(stat -c '%a' "`$authorized_keys")"
else
    if [[ "`$authorized_keys" == "`$ops_home/"* ]]; then
        file_owner="`$ops_user"
        file_group="`$ops_group"
    else
        file_owner='root'
        file_group='root'
    fi
    file_mode='600'
    touch "`$authorized_keys"
fi

cp -a "`$authorized_keys" "`$authorized_keys.backup-`$(date -u +%Y%m%dT%H%M%SZ)"

updated_file="`$(mktemp)"
found=0
while IFS= read -r line || [ -n "`$line" ]; do
    if [[ "`$line" == *"`$key_blob"* ]]; then
        found=1
        if [[ "`$line" =~ expiry-time=\"[^\"]*\" ]]; then
            line="`${line/`${BASH_REMATCH[0]}/expiry-time=\"`$expiry_timestamp\"}"
        else
            line="expiry-time=\"`$expiry_timestamp\",`$line"
        fi
        if [[ "`$line" != *restrict* ]]; then
            line="restrict,`$line"
        fi
    fi
    printf '%s\n' "`$line" >> "`$updated_file"
done < "`$authorized_keys"

if [ "`$found" -eq 0 ]; then
    printf 'restrict,expiry-time="%s" %s\n' "`$expiry_timestamp" "`$public_key" >> "`$updated_file"
fi

install -o "`$file_owner" -g "`$file_group" -m "`$file_mode" "`$updated_file" "`$authorized_keys"
rm -f "`$updated_file"

if command -v restorecon >/dev/null; then
    restorecon -RF "`$ssh_dir"
fi

# Renew the Unix account too, in case its expiration date caused the rejection.
chage -E "`$expiry_date" "`$ops_user"

# OpenSSH rejects public-key authentication when the Unix account itself is
# locked. Give it an unknown random password hash instead of restoring or
# creating a usable password; sshd still requires publickey for this account.
account_status="`$(passwd -S "`$ops_user" | awk '{ print `$2 }')"
if [ "`$account_status" = 'LK' ] || [ "`$account_status" = 'L' ]; then
    if ! command -v openssl >/dev/null; then
        echo 'openssl est requis pour deverrouiller le compte sans mot de passe connu.' >&2
        exit 22
    fi
    random_password="`$(openssl rand -base64 48 | tr -d '\n')"
    random_hash="`$(printf '%s' "`$random_password" | openssl passwd -6 -stdin)"
    printf '%s:%s\n' "`$ops_user" "`$random_hash" | chpasswd -e
    unset random_password random_hash
fi

echo "AuthorizedKeysFile utilise: `$authorized_keys"
echo "Etat du compte: `$(passwd -S "`$ops_user" | awk '{ print `$2 }')"
echo "Acces de `$ops_user renouvele jusqu'au `$expiry_date."
"@

$sshArguments = @('-T', '-o', 'StrictHostKeyChecking=yes')
if ($AdminIdentityFile) {
    $sshArguments += @('-i', $AdminIdentityFile)
}
$sshArguments += "${AdminUser}@${Server}"

if ($AdminUser -eq 'root') {
    $sshArguments += 'bash -s'
} else {
    $sshArguments += 'sudo -n bash -s'
}

Write-Host "Renouvellement de l'acces SSH $OpsUser sur $Server jusqu'au $expiryDate..."
$remoteScript | & ssh @sshArguments
if ($LASTEXITCODE -ne 0) {
    throw "Le renouvellement distant a echoue (code SSH $LASTEXITCODE)."
}

Write-Host 'Verification de la cle renouvelee...'
# Do not use BatchMode here: the operations key is passphrase-protected and SSH
# must be allowed to prompt for that passphrase during the interactive check.
& ssh -T -o StrictHostKeyChecking=yes -i $PrivateKeyFile `
    "${OpsUser}@${Server}" 'echo ICEFORGE_SSH_ACCESS_OK'
if ($LASTEXITCODE -ne 0) {
    $verificationExitCode = $LASTEXITCODE
    Write-Warning 'La verification a echoue. Collecte du diagnostic sshd avec le compte administrateur...'

    $diagnosticScript = @"
set -u
ops_user='$OpsUser'
key_blob='$keyBlob'
authorized_keys='/home/$OpsUser/.ssh/authorized_keys'

echo '--- Compte ---'
passwd -S "`$ops_user" 2>&1 || true
chage -l "`$ops_user" 2>&1 || true
getent passwd "`$ops_user" || true

echo '--- Fichier de cles ---'
namei -l "`$authorized_keys" 2>&1 || true
ls -ldZ "`$(dirname "`$authorized_keys")" "`$authorized_keys" 2>&1 || true
ssh-keygen -lf "`$authorized_keys" 2>&1 || true
awk -v key="`$key_blob" '
    index(`$0, key) {
        marker = index(`$0, "ssh-ed25519")
        if (marker > 0) print substr(`$0, 1, marker - 1) "ssh-ed25519 <cle-correspondante>"
    }
' "`$authorized_keys" 2>&1 || true

echo '--- Configuration sshd effective ---'
client_addr="`${SSH_CONNECTION%% *}"
server_host="`$(hostname -f 2>/dev/null || hostname)"
sshd -T -C "user=`$ops_user,host=`$server_host,addr=`$client_addr" 2>&1 |
    grep -E '^(authorizedkeysfile|authorizedkeyscommand|pubkeyauthentication|authenticationmethods|usepam|strictmodes|allowusers|denyusers)' || true

echo '--- Refus sshd recents ---'
journalctl -u sshd --since '-10 minutes' --no-pager 2>&1 |
    grep -E "`$ops_user|Authentication refused|Failed publickey|bad ownership|expired|locked" |
    tail -n 40 || true
"@

    $diagnosticSshArguments = @('-T', '-o', 'StrictHostKeyChecking=yes')
    if ($AdminIdentityFile) {
        $diagnosticSshArguments += @('-i', $AdminIdentityFile)
    }
    $diagnosticSshArguments += "${AdminUser}@${Server}"
    if ($AdminUser -eq 'root') {
        $diagnosticSshArguments += 'bash -s'
    } else {
        $diagnosticSshArguments += 'sudo -n bash -s'
    }

    $diagnosticScript | & ssh @diagnosticSshArguments
    throw "La modification a ete appliquee, mais la verification SSH a echoue (code $verificationExitCode). Le diagnostic est affiche ci-dessus."
}

Write-Host "OK: acces SSH renouvele jusqu'au $expiryDate."
