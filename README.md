# Mirokaï Experience — Jeu

Jeu interactif affiché en salle lors de la Mirokaï Experience.
Construit avec **React**, **Vite** et **Phaser 3**.

> **Mobile uniquement.** Le jeu est conçu pour être utilisé sur smartphone par les visiteurs présents dans la salle.

Les visiteurs naviguent sur une map tile-based représentant le plan de l'expérience et explorent les modules.

---

## Fonctionnement

- La map est basée sur le plan de l'expérience (1536×1418 px) découpé en tuiles 32×32 px (48×44 tuiles)
- Les modules sont chargés depuis l'API et placés sur la map selon leurs coordonnées `mapX`/`mapY` (en pourcentage)
- Si l'API est indisponible, des positions de fallback codées en dur prennent le relais

---

## Architecture

```
competition-front-game/
├── src/
│   ├── game/
│   │   └── MainScene.ts        → Scène principale Phaser (map + personnage + modules)
│   ├── screens/
│   │   └── GameScreen.tsx      → Composant React qui instancie le jeu
│   └── main.tsx
└── public/
    └── assets/                 → Tilesets, sprites, map JSON (Tiled)
```

---

## Prérequis

- **Node.js** 20+
- **pnpm** — `npm install -g pnpm`
- Le [backend](../back-project) lancé (local ou production)

---

## Installation

```bash
git clone <url-du-repo>
cd competition-front-game
pnpm install
```

---

## Configuration

Créer un fichier `.env` à la racine :

```env
VITE_API_URL=http://localhost:3001/api
```

---

## Lancer en développement

```bash
pnpm dev
```

Ouvrir `http://localhost:5173`

---

## Correspondance map / plan

Les positions des modules sont stockées en **pourcentage** dans la base de données (`mapX` et `mapY` entre 0 et 1).

Le jeu les convertit en coordonnées de tuiles :

```ts
tileX = Math.round(mapX * 48)  // 48 tuiles en largeur
tileY = Math.round(mapY * 44)  // 44 tuiles en hauteur
```

Les positions sont définies depuis l'interface admin via le glisser-déposer sur le plan.

---

## Dimensions de la map Tiled

| Paramètre | Valeur |
|---|---|
| Largeur | 48 tuiles |
| Hauteur | 44 tuiles |
| Taille d'une tuile | 32×32 px |
| Résolution totale | 1536×1408 px |

---

## Build & déploiement

```bash
pnpm build
```

Le dossier `dist/` contient les fichiers statiques à servir.

### Variables d'environnement en production

```env
VITE_API_URL=https://api.mirokai-experience.fr/api
```

> Le jeu est optimisé pour mobile (portrait). Il n'est pas prévu pour une utilisation sur desktop.
