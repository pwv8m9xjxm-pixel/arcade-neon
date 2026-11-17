/* ==========================================================================
   scores.js — Les classements (top 10 de chaque jeu)
   --------------------------------------------------------------------------
   Les scores sont sauvegardés dans le « localStorage » du navigateur :
   une petite mémoire qui reste même quand on ferme la page. Elle ne stocke
   que du TEXTE, donc on transforme nos données en texte avec JSON.stringify
   et on les relit avec JSON.parse.

   Attention : le localStorage peut être indisponible (navigation privée,
   réglages stricts…). Dans ce cas, il « lance une erreur ». On entoure donc
   chaque accès d'un try { … } catch { … } : si ça plante, on attrape
   l'erreur et le site continue de marcher (les scores restent alors en
   mémoire jusqu'à la fermeture de la page).

   Les données ressemblent à ça :
   {
     "snake": [ { "pseudo": "MATEO", "valeur": 420, "date": 1700000000000 }, … ],
     "demineur-facile": [ … ]
   }
   ========================================================================== */

Arcade.scores = (function () {
  const CLE_SCORES = 'arcadeNeon.scores';
  const CLE_PSEUDO = 'arcadeNeon.pseudo';
  const TAILLE_TOP = 10;

  let stockageOk = true; // passe à false si le localStorage ne marche pas

  /* --- Lecture / écriture protégées par try/catch --- */
  function lire(cle) {
    try {
      return localStorage.getItem(cle);
    } catch (erreur) {
      stockageOk = false;
      return null;
    }
  }

  function ecrire(cle, valeur) {
    try {
      localStorage.setItem(cle, valeur);
    } catch (erreur) {
      stockageOk = false;
    }
  }

  /* --- Chargement au démarrage --- */
  let tous = {};
  try {
    const texte = lire(CLE_SCORES);
    const donnees = texte ? JSON.parse(texte) : {};
    if (donnees && typeof donnees === 'object') tous = donnees;
  } catch (erreur) {
    tous = {}; // texte abîmé : on repart de zéro
  }
  let pseudo = lire(CLE_PSEUDO) || '';

  // On vérifie qu'on peut vraiment écrire (sinon on affichera un avertissement)
  ecrire('arcadeNeon.test', '1');
  try { localStorage.removeItem('arcadeNeon.test'); } catch (erreur) { /* rien */ }

  function sauvegarder() {
    ecrire(CLE_SCORES, JSON.stringify(tous));
  }

  /* --- Les classements --- */

  // Renvoie le top 10 d'un classement (une copie, triée du meilleur au moins bon)
  function liste(cle) {
    const l = tous[cle];
    if (!Array.isArray(l)) return [];
    return l.filter(function (e) {
      return e && typeof e.valeur === 'number' && typeof e.pseudo === 'string';
    });
  }

  function meilleur(cle) {
    return liste(cle)[0] || null;
  }

  // a est-il strictement meilleur que b ?
  function estMeilleur(a, b, ordre) {
    return ordre === 'petit' ? a < b : a > b;
  }

  /* Quel rang obtiendrait cette valeur ? (1 à 10, ou 0 si hors du top 10)
     À égalité, le score le plus ancien reste devant. */
  function rangPotentiel(cle, valeur, ordre) {
    if (typeof valeur !== 'number' || !isFinite(valeur)) return 0;
    if (ordre !== 'petit' && valeur <= 0) return 0; // 0 point = pas de classement
    let rang = 1;
    for (const e of liste(cle)) {
      if (estMeilleur(valeur, e.valeur, ordre)) break;
      rang++;
    }
    return rang <= TAILLE_TOP ? rang : 0;
  }

  // Ajoute un score et renvoie son rang (0 s'il n'entre pas dans le top 10)
  function ajouter(cle, nom, valeur, ordre) {
    const rang = rangPotentiel(cle, valeur, ordre);
    if (!rang) return 0;
    const l = liste(cle);
    l.splice(rang - 1, 0, { pseudo: nom, valeur: valeur, date: Date.now() });
    tous[cle] = l.slice(0, TAILLE_TOP);
    sauvegarder();
    return rang;
  }

  function effacer(cle) {
    delete tous[cle];
    sauvegarder();
  }

  function effacerTout() {
    tous = {};
    sauvegarder();
  }

  /* --- Le pseudo --- */

  // Sans argument : renvoie le dernier pseudo. Avec un argument : le mémorise.
  function dernierPseudo(nouveau) {
    if (nouveau !== undefined) {
      pseudo = nouveau;
      ecrire(CLE_PSEUDO, pseudo);
    }
    return pseudo;
  }

  // Majuscules, 10 caractères maximum, « JOUEUR » si vide
  function nettoyerPseudo(texte) {
    const propre = String(texte || '').trim().toUpperCase().slice(0, 10);
    return propre || 'JOUEUR';
  }

  /* --- Affichage d'une valeur --- */
  function formater(valeur, format) {
    if (format === 'temps') {
      // valeur en millisecondes → « 12,3 s »
      return (valeur / 1000).toFixed(1).replace('.', ',') + ' s';
    }
    // 12345 → « 12 345 » (une espace tous les 3 chiffres)
    return String(valeur).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // Ce que le reste du site a le droit d'utiliser :
  return {
    liste: liste,
    meilleur: meilleur,
    rangPotentiel: rangPotentiel,
    ajouter: ajouter,
    effacer: effacer,
    effacerTout: effacerTout,
    dernierPseudo: dernierPseudo,
    nettoyerPseudo: nettoyerPseudo,
    formater: formater,
    stockageDisponible: function () { return stockageOk; }
  };
})();
