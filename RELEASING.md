# Vydávání Grocy Homie

Každá nová verze se vydává současně pro standardní Docker deployment i Home Assistant.

## Povinný postup

1. Navýšit stejnou verzi v `package.json`, `package-lock.json` a `home-assistant-addon/config.yaml`.
2. Doplnit `home-assistant-addon/CHANGELOG.md`.
3. Ověřit `npm run test:server` a `npm run build`.
4. Ověřit kořenový `Dockerfile` i `home-assistant-addon/Dockerfile`.
5. Pushnout commit do `main` a vytvořit tag `vX.Y.Z`.
6. Zkontrolovat GitHub Actions a multiarch image v GHCR.

Workflow publikuje jeden společný image `ghcr.io/beefydaddy2510/kanban-grocery`, který je kompatibilní s oběma způsoby nasazení:

- `latest` pro běžný Docker deployment,
- přesný tag verze, například `1.4.0`, pro Docker i Home Assistant,
- zkrácený tag řady, například `1.4`.

Home Assistant načte přesný tag z hodnoty `version` v `home-assistant-addon/config.yaml`.
