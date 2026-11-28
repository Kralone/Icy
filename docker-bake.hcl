# Construction des images IceForge avec BuildKit, en local comme en CI.
#
#   docker buildx bake -f docker-bake.hcl       # backend, bot et frontend, tagués iceforge/*:local
#   docker buildx bake -f docker-bake.hcl all   # avec les images SSR et proxy (scan de sécurité)
#
# Toujours passer -f : sans lui, bake fusionne aussi docker-compose.yml dans les cibles.
#
# La CI règle les variables ci-dessous : cache GitHub Actions, tests sautés (déjà lancés
# par le job backend), date de rafraîchissement des paquets système et préfixe du registre.

variable "IMAGE_PREFIX" {
  # iceforge/ en local et pour Compose ; ghcr.io/kralone/iceforge- pour la livraison.
  default = "iceforge/"
}

variable "TAG" {
  default = "local"
}

variable "BUILD_COMMIT" {
  default = "unknown"
}

variable "SKIP_TESTS" {
  default = "false"
}

variable "OS_PACKAGES_REFRESH" {
  default = ""
}

# "gha" active le cache de couches GitHub Actions ; vide en local (cache du démon).
variable "CACHE" {
  default = ""
}

function "cache_from" {
  params = [name]
  result = CACHE == "gha" ? ["type=gha,scope=iceforge-${name}"] : []
}

function "cache_to" {
  params = [name]
  result = CACHE == "gha" ? ["type=gha,mode=max,scope=iceforge-${name}"] : []
}

group "default" {
  targets = ["backend", "bot", "frontend"]
}

group "all" {
  targets = ["backend", "bot", "frontend", "frontend-ssr", "frontend-proxy"]
}

target "_common" {
  args = {
    OS_PACKAGES_REFRESH = OS_PACKAGES_REFRESH
  }
  labels = {
    "org.opencontainers.image.source"   = "https://github.com/Kralone/Icy"
    "org.opencontainers.image.revision" = BUILD_COMMIT
  }
}

target "backend" {
  inherits   = ["_common"]
  context    = "icy_backend"
  dockerfile = "Dockerfile"
  args = {
    SKIP_TESTS = SKIP_TESTS
  }
  tags       = ["${IMAGE_PREFIX}backend:${TAG}"]
  cache-from = cache_from("backend")
  cache-to   = cache_to("backend")
}

target "bot" {
  inherits   = ["_common"]
  context    = "icy"
  dockerfile = "Dockerfile"
  tags       = ["${IMAGE_PREFIX}bot:${TAG}"]
  cache-from = cache_from("bot")
  cache-to   = cache_to("bot")
}

target "frontend" {
  inherits   = ["_common"]
  context    = "icy-angular"
  dockerfile = "Dockerfile"
  args = {
    ICEFORGE_BUILD_COMMIT = BUILD_COMMIT
  }
  tags       = ["${IMAGE_PREFIX}frontend:${TAG}"]
  cache-from = cache_from("frontend")
  cache-to   = cache_to("frontend")
}

target "frontend-ssr" {
  inherits   = ["_common"]
  context    = "icy-angular"
  dockerfile = "Dockerfile.ssr"
  tags       = ["${IMAGE_PREFIX}frontend-ssr:${TAG}"]
  cache-from = cache_from("frontend-ssr")
  cache-to   = cache_to("frontend-ssr")
}

target "frontend-proxy" {
  inherits   = ["_common"]
  context    = "icy-angular"
  dockerfile = "Dockerfile.proxy"
  tags       = ["${IMAGE_PREFIX}frontend-proxy:${TAG}"]
  cache-from = cache_from("frontend-proxy")
  cache-to   = cache_to("frontend-proxy")
}
