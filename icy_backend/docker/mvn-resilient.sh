#!/bin/sh
# Lance Maven en tolérant les refus passagers de Maven Central (429 ou « absent »,
# fréquents depuis les runners CI) : deux essais sur Maven Central, puis bascule
# sur le miroir Google de Maven Central. Une fois la bascule faite, les appels
# suivants de la même construction utilisent directement le miroir.
set -u

settings=/tmp/maven-mirror-settings.xml
marker=/tmp/.maven-use-mirror

cat >"$settings" <<'XML'
<settings>
  <mirrors>
    <mirror>
      <id>google-maven-central</id>
      <name>Miroir Google de Maven Central</name>
      <url>https://maven-central.storage-download.googleapis.com/maven2/</url>
      <mirrorOf>central</mirrorOf>
    </mirror>
  </mirrors>
</settings>
XML

if [ -f "$marker" ]; then
  exec mvn -s "$settings" "$@"
fi

for attempt in 1 2; do
  mvn -U "$@" && exit 0
  echo "Maven Central en échec (tentative $attempt)" >&2
  sleep $((attempt * 15))
done

echo 'Maven Central indisponible : bascule sur le miroir Google de Maven Central' >&2
touch "$marker"
for attempt in 1 2; do
  mvn -U -s "$settings" "$@" && exit 0
  echo "Miroir en échec (tentative $attempt)" >&2
  sleep $((attempt * 15))
done
exit 1
