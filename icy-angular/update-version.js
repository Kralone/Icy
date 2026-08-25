const fs = require('fs');
const path = require('path');

// Chemins des fichiers
const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, 'package.json');
const versionFilePath = path.join(rootDir, 'src', 'assets', 'version.json');

console.log('\n📦 [ICY-UPDATE] Génération du fichier de version...');

try {
  // 1. Lire la version actuelle dans le package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = packageJson.version || '0.0.0';

  // 2. Créer l'objet de données
  const versionData = {
    version: currentVersion,
    commit: process.env.ICEFORGE_BUILD_COMMIT || 'unknown',
    hash: new Date().getTime().toString(), // Hash unique basé sur le temps
    date: new Date().toISOString()
  };

  // 3. Vérifier si le dossier assets existe, sinon le créer
  const assetsDir = path.join(rootDir, 'src', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // 4. Écrire le fichier version.json
  fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));

  console.log(`✅ [ICY-UPDATE] Fichier généré avec succès dans src/assets/version.json`);
  console.log(`🚀 Hash : ${versionData.hash}\n`);

} catch (error) {
  console.error('❌ [ICY-UPDATE] Erreur lors de la génération de la version :', error.message);
  process.exit(1);
}
