/* ==========================================================================
   arcade.js — Le cœur commun de l'Arcade Néon
   --------------------------------------------------------------------------
   Ce fichier est chargé EN PREMIER (voir l'ordre des <script> dans
   index.html). Il crée l'objet global « Arcade » : une grande boîte dans
   laquelle tous les autres fichiers rangent leurs outils.

   Contenu :
     - Arcade.couleurs        → la palette néon
     - Arcade.jeux            → la liste des jeux (chaque jeu vient s'inscrire)
     - Arcade.creerBoucle()   → une boucle d'animation réutilisable
     - Arcade.sprite()        → transforme un dessin écrit en texte en image pixel
     - Arcade.texte()         → écrit du texte « néon » sur un canvas
     - Arcade.ajuster()       → redimensionne le jeu pour qu'il tienne à l'écran
     - quelques petits outils de calcul
   ========================================================================== */

// Un seul objet global pour tout le site. Comme ça, les variables des
// différents fichiers ne risquent pas de se marcher dessus.
var Arcade = {};


/* ---------- Palette néon (les mêmes couleurs que dans css/style.css) ---------- */
Arcade.couleurs = {
  rose: '#ff2bd6',
  cyan: '#00f0ff',
  vert: '#39ff14',
  jaune: '#ffe600',
  orange: '#ff8a00',
  violet: '#a64dff',
  rouge: '#ff3355',
  bleu: '#4d7cff',
  blanc: '#f4f4ff',
  fond: '#000010'
};

// Police utilisée pour écrire dans les canvas
Arcade.police = '"Press Start 2P", "Courier New", monospace';


/* ---------- Registre des jeux ----------
   Chaque fichier de js/games/ appelle Arcade.enregistrerJeu({...}) pour
   s'ajouter à la liste. Le menu est ensuite construit à partir de cette
   liste : ajouter un jeu = ajouter un fichier, sans toucher au menu ! */
Arcade.jeux = [];

Arcade.enregistrerJeu = function (jeu) {
  Arcade.jeux.push(jeu);
};

Arcade.trouverJeu = function (id) {
  return Arcade.jeux.find(function (jeu) { return jeu.id === id; }) || null;
};

/* Un jeu peut avoir plusieurs classements (ex. : Démineur = 3 niveaux).
   S'il n'en précise pas, il a un seul classement « au plus grand score ».
   - cle    : nom sous lequel le classement est sauvegardé
   - ordre  : 'grand' (plus grand = meilleur) ou 'petit' (plus petit = meilleur)
   - format : 'points' ou 'temps' (pour l'affichage) */
Arcade.classementsDuJeu = function (jeu) {
  return jeu.classements || [
    { cle: jeu.id, titre: jeu.nom, ordre: 'grand', format: 'points' }
  ];
};

Arcade.trouverClassement = function (cle) {
  for (const jeu of Arcade.jeux) {
    for (const def of Arcade.classementsDuJeu(jeu)) {
      if (def.cle === cle) return def;
    }
  }
  return null;
};


/* ---------- La boucle de jeu ----------
   Un jeu d'action se redessine environ 60 fois par seconde. Le navigateur
   nous aide avec requestAnimationFrame(fonction) : « appelle cette fonction
   juste avant d'afficher la prochaine image ».

   creerBoucle(miseAJour) renvoie un objet avec deux méthodes :
     - demarrer() : lance (ou relance après une pause) la boucle
     - arreter()  : l'arrête (pause ou fin de partie)
   À chaque image, miseAJour(dt) est appelée. « dt » (delta temps) est le
   temps écoulé depuis l'image précédente, en secondes (≈ 0,016 à 60 i/s).
   On multiplie les vitesses par dt : ainsi le jeu va à la même vitesse
   sur un écran 60 Hz ou 120 Hz. */
Arcade.creerBoucle = function (miseAJour) {
  let idAnimation = null; // numéro de la prochaine image demandée (null = arrêtée)
  let tempsPrecedent = 0;

  function tour(temps) {
    // On limite dt à 0,05 s : si le navigateur a « gelé » un instant,
    // le jeu ne fait pas un énorme bond en avant.
    const dt = Math.max(0, Math.min((temps - tempsPrecedent) / 1000, 0.05));
    tempsPrecedent = temps;
    miseAJour(dt);
    // Si miseAJour() a appelé arreter(), idAnimation vaut null : on s'arrête.
    if (idAnimation !== null) {
      idAnimation = requestAnimationFrame(tour);
    }
  }

  return {
    demarrer: function () {
      if (idAnimation !== null) return; // déjà en route
      tempsPrecedent = performance.now();
      idAnimation = requestAnimationFrame(tour);
    },
    arreter: function () {
      if (idAnimation !== null) cancelAnimationFrame(idAnimation);
      idAnimation = null;
    }
  };
};


/* ---------- Sprites en pixels ----------
   On « dessine » un sprite avec du texte : chaque caractère est un pixel.
   Un point « . » = pixel transparent.
   Exemple :  ['.##.',
               '####',
               '.##.']
   - palette : soit une couleur ('#ff0000') pour tous les pixels,
               soit un objet { Y: '#ffe600', W: '#ffffff' } (une couleur par lettre)
   - taillePixel : taille d'un pixel à l'écran (2 = chaque pixel fait 2×2)
   - lueur : intensité du halo néon autour du sprite (0 = aucun)

   Le sprite est dessiné UNE fois dans un petit canvas caché, qu'on recopie
   ensuite à chaque image avec drawImage : c'est beaucoup plus rapide que
   de redessiner chaque pixel 60 fois par seconde. */
Arcade.sprite = function (lignes, palette, taillePixel, lueur) {
  taillePixel = taillePixel || 1;
  lueur = lueur || 0;
  const largeur = lignes[0].length * taillePixel;
  const hauteur = lignes.length * taillePixel;

  // 1) Les pixels, bien nets
  const net = document.createElement('canvas');
  net.width = largeur;
  net.height = hauteur;
  const ctxNet = net.getContext('2d');
  for (let y = 0; y < lignes.length; y++) {
    for (let x = 0; x < lignes[y].length; x++) {
      const caractere = lignes[y][x];
      if (caractere === '.' || caractere === ' ') continue;
      const couleur = typeof palette === 'string' ? palette : palette[caractere];
      if (!couleur) continue;
      ctxNet.fillStyle = couleur;
      ctxNet.fillRect(x * taillePixel, y * taillePixel, taillePixel, taillePixel);
    }
  }
  if (!lueur) {
    net.marge = 0;
    return net;
  }

  // 2) Une copie avec un halo lumineux tout autour (on laisse une marge pour le halo)
  const final = document.createElement('canvas');
  final.width = largeur + lueur * 2;
  final.height = hauteur + lueur * 2;
  const ctxFinal = final.getContext('2d');
  ctxFinal.shadowColor = typeof palette === 'string' ? palette : (palette.lueur || '#ffffff');
  ctxFinal.shadowBlur = lueur;
  ctxFinal.drawImage(net, lueur, lueur);
  final.marge = lueur; // on retient la marge pour bien placer le sprite
  return final;
};

// Dessine un sprite dont le coin haut-gauche (sans le halo) est en (x, y)
Arcade.dessinerSprite = function (ctx, sprite, x, y) {
  ctx.drawImage(sprite, Math.round(x - sprite.marge), Math.round(y - sprite.marge));
};


/* ---------- Texte néon dans un canvas ---------- */
Arcade.texte = function (ctx, texte, x, y, taille, couleur, alignement) {
  ctx.save(); // mémorise les réglages du pinceau…
  ctx.font = taille + 'px ' + Arcade.police;
  ctx.textAlign = alignement || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = couleur;
  ctx.shadowColor = couleur;
  ctx.shadowBlur = 8;
  ctx.fillText(texte, x, y);
  ctx.restore(); // …et les remet comme avant
};


/* ---------- Étoiles de fond (Flappy, Invasion) ---------- */
Arcade.creerEtoiles = function (nombre, largeur, hauteur) {
  const etoiles = [];
  for (let i = 0; i < nombre; i++) {
    etoiles.push({
      x: Math.random() * largeur,
      y: Math.random() * hauteur,
      taille: Math.random() < 0.8 ? 1 : 2,
      vitesse: 0.3 + Math.random() * 0.7, // les petites étoiles « lointaines » vont moins vite
      phase: Math.random() * Math.PI * 2
    });
  }
  return etoiles;
};

// Fait défiler les étoiles (vx, vy en pixels par seconde) et les fait scintiller
Arcade.animerEtoiles = function (etoiles, dt, vx, vy, largeur, hauteur) {
  for (const e of etoiles) {
    e.x += vx * e.vitesse * dt;
    e.y += vy * e.vitesse * dt;
    // Une étoile qui sort d'un côté réapparaît de l'autre
    if (e.x < 0) e.x += largeur;
    if (e.x > largeur) e.x -= largeur;
    if (e.y < 0) e.y += hauteur;
    if (e.y > hauteur) e.y -= hauteur;
    e.phase += dt * 3;
  }
};

Arcade.dessinerEtoiles = function (ctx, etoiles) {
  ctx.fillStyle = '#ffffff';
  for (const e of etoiles) {
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(e.phase);
    ctx.fillRect(Math.round(e.x), Math.round(e.y), e.taille, e.taille);
  }
  ctx.globalAlpha = 1;
};


/* ---------- Mise à l'échelle ----------
   Chaque jeu a une taille « logique » fixe (par ex. 360 × 540 pixels).
   Cette fonction calcule la plus grande taille d'affichage qui tient dans
   le conteneur sans déformer l'image, puis l'applique à l'élément.
   Elle écrit aussi la largeur obtenue dans la variable CSS --l, utilisée
   par 2048 et le Démineur pour adapter la taille du texte. */
Arcade.ajuster = function (element, largeur, hauteur, conteneur) {
  const style = getComputedStyle(conteneur);
  const dispoL = conteneur.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const dispoH = conteneur.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  // On prend le plus petit rapport (sinon ça déborderait d'un côté),
  // en évitant que le jeu devienne gigantesque sur un grand écran.
  const echelle = Math.max(0.1, Math.min(dispoL / largeur, dispoH / hauteur, 640 / largeur, 860 / hauteur));
  const l = Math.floor(largeur * echelle);
  const h = Math.floor(hauteur * echelle);
  element.style.width = l + 'px';
  element.style.height = h + 'px';
  element.style.setProperty('--l', l + 'px');
};


/* ---------- Petits outils de calcul ---------- */

// Garde une valeur entre un minimum et un maximum
Arcade.limiter = function (valeur, min, max) {
  return Math.max(min, Math.min(max, valeur));
};

// Nombre entier au hasard entre min et max (inclus)
Arcade.entierAuHasard = function (min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
};

// Deux rectangles {x, y, l, h} se chevauchent-ils ?
Arcade.collision = function (a, b) {
  return a.x < b.x + b.l && a.x + a.l > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
};
