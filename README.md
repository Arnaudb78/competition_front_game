# Mirokaï Experience — Jeu

Jeu interactif affiché en salle lors de la Mirokaï Experience.
Construit avec **React 19**, **Vite 7**, **Phaser 3** et **Tailwind CSS**.
Déployé sur `https://game.xn--miroka-experience-jwb.fr/`

> **Mobile uniquement.** Le jeu est conçu pour être utilisé sur smartphone (portrait) par les visiteurs présents dans la salle. L'accès desktop affiche un écran de blocage avec QR code.

---

## Fonctionnement

Les visiteurs incarnent Miroki et explorent une map tile-based représentant le plan de l'expérience. Ils interagissent avec des modules répartis dans la salle et dialoguent avec un PNJ guide.

- Les modules sont chargés depuis l'API et positionnés sur la map via leurs coordonnées `mapX`/`mapY` (en pourcentage 0–1)
- Si l'API est indisponible, des positions de fallback codées en dur prennent le relais
- Le jeu est installable en PWA (plein écran, portrait, thème sombre)

---

## Architecture

```
competition-front-game/
├── src/
│   ├── game/
│   │   └── MainScene.ts        → Scène Phaser (map, joueur, NPCs, modules, collisions)
│   ├── screens/
│   │   ├── HomeScreen.tsx      → Écran d'accueil / menu
│   │   ├── GameScreen.tsx      → Intégration React + Phaser, UI HUD, dialogues, contrôles
│   │   └── DesktopBlock.tsx    → Blocage desktop + QR code
│   ├── App.tsx                 → Router + détection mobile
│   └── main.tsx                → Point d'entrée React
└── public/
    ├── assets/
    │   ├── South/North/East/West.png     → Sprites joueur (Miroki)
    │   ├── Miroka_*.png                  → Sprites PNJ Miroka
    │   └── map.png                       → Fond de la map
    └── map-game.tmj                      → Carte Tiled (collisions, calques)
```

---

## Gameplay

### Mode exploration (principal)

1. Le joueur se déplace sur la map tuile par tuile (haut/bas/gauche/droite)
2. En approchant d'un **module** (cercle violet), un popup s'affiche avec le contenu du module
3. En approchant du **PNJ guide**, un système de dialogues s'active
4. Une fois tous les modules explorés, un nouveau personnage apparaît sur la map
5. Trouver ce personnage déclenche la condition de victoire

### Mode secret

Un mode caché existe dans le jeu. Explorez l'interface et les menus pour trouver comment y accéder. Il propose plusieurs niveaux de difficulté.

### Contrôles

Le jeu est jouable sur mobile via des **contrôles style Game Boy** affichés à l'écran :
- **D-pad** : déplacement dans les 4 directions
- **Bouton A** : interaction / action
- **Bouton B** : action secondaire (selon le mode)

---

## Dimensions de la map

| Paramètre | Valeur |
|---|---|
| Largeur | 48 tuiles |
| Hauteur | 44 tuiles |
| Taille d'une tuile | 32×32 px |
| Résolution totale | 1536×1408 px |

Les positions des modules sont converties depuis les pourcentages de l'API :
```ts
tileX = Math.round(mapX * 48)
tileY = Math.round(mapY * 44)
```

---

## Prérequis

- **Node.js** 20+
- **pnpm** — `npm install -g pnpm`
- Le [backend](https://github.com/Arnaudb78/competition_project_back) lancé (local ou production)

---

## Installation

```bash
git clone <url-du-repo>
cd competition-front-game
pnpm install
```

---

## Configuration

Créer un fichier `.env` à la racine (voir `.env.example`) :

```env
VITE_APP_ENV=development
VITE_API_URL=http://localhost:3001/api
VITE_APP_CODE=<code_secret>
```

---

## Lancer en développement

```bash
pnpm dev
```

Ouvrir `http://localhost:5173`

> Pour tester sur desktop, activer le mode mobile dans les DevTools (ex : iPhone 14 Pro dans Chrome).

---

## Build & déploiement

```bash
pnpm build
```

Le dossier `dist/` contient les fichiers statiques à servir.

### Variables d'environnement en production

```env
VITE_APP_ENV=production
VITE_API_URL=https://api.mirokai-experience.fr/api
VITE_APP_CODE=<code_secret>
```
