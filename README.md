# 🕹️ Arcade Néon

Un site d'arcade rétro années 80 avec **8 jeux**, jouable dans le navigateur, sur ordinateur comme sur téléphone.
Le site est écrit uniquement en **HTML, CSS et JavaScript « vanilla »** : pas de framework, pas de npm, pas d'installation.

| N° | Jeu | Principe |
|----|-----|----------|
| 1 | **2048** | Fusionner les tuiles identiques |
| 2 | **Snake** | Manger les pommes sans se cogner |
| 3 | **Blocs** | Compléter des lignes avec des pièces qui tombent |
| 4 | **Casse-briques** | Détruire les briques avec la balle |
| 5 | **Ping-Pong** | Battre l'ordinateur (terrain vertical) |
| 6 | **Flappy** | Faire voler l'oiseau entre les colonnes |
| 7 | **Invasion** | Repousser des vagues d'aliens |
| 8 | **Démineur** | Trouver les mines, 3 niveaux, classement au temps |

---

## ▶️ Lancer le site

1. Double-clique sur **`index.html`**.
2. C'est tout ! Le site s'ouvre dans ton navigateur.

> 💡 La police pixel « Press Start 2P » vient d'internet (Google Fonts).
> Sans connexion, le site marche quand même avec une police de secours.

---

## 🎮 Contrôles

Chaque jeu affiche ses contrôles sur son écran de départ. En résumé :

- **Ordinateur** : flèches ou **ZQSD**, **Espace**, souris.
- **Téléphone** : balayages (2048, Snake, Blocs), glisser le doigt (Casse-briques, Ping-Pong), toucher l'écran (Flappy), boutons sous le jeu (Invasion, Blocs, Démineur).
- **Pause** : touche **P** ou **Échap**, ou le bouton **❚❚** en haut à droite.

---

## 🏆 Scores

- Chaque jeu a son **top 10**. Le Démineur en a trois, un par niveau, classés au **meilleur temps**.
- Si ton score entre dans le top 10, le jeu te demande ton pseudo. Il retient le dernier pseudo utilisé.
- Les scores sont sauvegardés dans le **localStorage** du navigateur : ils restent même si tu fermes la page.
  ⚠️ Ils sont propres à **ce** navigateur, sur **cet** appareil. Ton téléphone et ton ordinateur ont chacun leurs propres scores.
- La page **Classements** affiche tous les tops et permet de les effacer (avec confirmation).

---

## 📁 Organisation du code

```
arcade-neon/
├── index.html            La seule page HTML : menu, classements et écran de jeu
├── README.md             Ce fichier
├── css/
│   └── style.css         Tout le style : néon, police pixel, mise en page mobile
└── js/
    ├── arcade.js         Le cœur : objet « Arcade », boucle de jeu, sprites, outils
    ├── scores.js         Les classements (localStorage + try/catch)
    ├── controles.js      Clavier, balayages tactiles, boutons à l'écran
    ├── ecrans.js         Écrans communs : départ, pause, fin, saisie du pseudo
    ├── main.js           Le chef d'orchestre : menu, navigation, déroulement d'une partie
    └── games/            Un fichier par jeu
        ├── jeu2048.js
        ├── snake.js
        ├── blocs.js
        ├── casse-briques.js
        ├── ping-pong.js
        ├── flappy.js
        ├── invasion.js
        └── demineur.js
```

### L'ordre de chargement des scripts compte

Dans `index.html`, les fichiers sont chargés dans cet ordre :

1. `arcade.js` crée l'objet global `Arcade`, que tous les autres fichiers utilisent.
2. `scores.js`, `controles.js` et `ecrans.js` ajoutent leurs outils dans `Arcade`.
3. Chaque jeu s'**inscrit** avec `Arcade.enregistrerJeu({...})`. L'ordre des `<script>` décide de l'ordre dans le menu.
4. `main.js` est chargé en dernier et démarre le site.

### Le « contrat » d'un jeu

Tous les jeux ont la même forme. C'est pour ça que le menu, la pause, l'écran de fin et les classements sont écrits **une seule fois** pour les 8 jeux.

```js
Arcade.enregistrerJeu({
  id: 'snake',                        // identifiant unique (sert aussi pour le classement)
  nom: 'SNAKE',
  couleur: Arcade.couleurs.vert,
  resume: 'Mange, grandis, survis',   // texte court de la carte du menu
  description: '…',                   // texte de l'écran de départ
  icone: ['..##..', '.####.', …],     // petit dessin en pixels (# = pixel allumé)
  controles: [['FLÈCHES / ZQSD', 'Diriger le serpent'], …],

  demarrer(zone, api, option) { … }, // crée le jeu et le lance
  pause() { … },
  reprendre() { … },
  arreter() { … },                    // arrête boucles et minuteurs

  // facultatif :
  touche(code, evenement) { … },      // touche du clavier
  balayage(direction) { … },          // 'haut' | 'bas' | 'gauche' | 'droite'
  tape(evenement) { … },              // toucher court
  appui(evenement) { … },             // le doigt / la souris se pose
});
```

Le jeu reçoit un objet `api` pour communiquer avec le site :

- `api.creerCanvas(largeur, hauteur)` crée une zone de dessin, adaptée automatiquement à la taille de l'écran ;
- `api.hud('SCORE 120', 'NIVEAU 3')` met à jour la ligne d'infos ;
- `api.boutonTactile('FEU', 'Space')` ajoute un bouton qui fait comme la touche Espace ;
- `api.fin({ valeur: score, titre: 'GAME OVER', details: '…' })` termine la partie.

### Ajouter un 9ᵉ jeu

1. Copie un jeu simple (par exemple `snake.js`) dans `js/games/mon-jeu.js`.
2. Change l'`id`, le `nom`, la couleur, puis le code du jeu.
3. Ajoute `<script src="js/games/mon-jeu.js"></script>` dans `index.html`, **avant** `main.js`.

Le menu, la pause, la fin de partie et le classement marchent tout seuls.

---

## 🛠️ Déboguer

Ouvre la **console** du navigateur avec `F12`, ou `Cmd + Option + J` sur Mac (Chrome). Les erreurs JavaScript s'y affichent en rouge, avec le nom du fichier et le numéro de ligne.
