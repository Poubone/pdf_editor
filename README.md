# PDF Local — Éditeur de PDF privé

Éditeur de PDF **100% local** : vos documents sont traités entièrement dans votre navigateur, sans envoi vers un serveur.

## Fonctionnalités

- **Import** — glisser-déposer ou sélection de fichier PDF
- **Texte** — ajouter du texte sur n'importe quelle page
- **Dessin** — annotations à main levée
- **Signature** — créer et placer une signature
- **Navigation** — pages, zoom
- **Annuler** — Ctrl+Z
- **Téléchargement** — exporter le PDF modifié

## Confidentialité

Contrairement aux services en ligne (iLovePDF, Smallpdf, etc.), **aucun fichier n'est uploadé**. Tout le traitement utilise JavaScript côté client (`pdf.js` pour l'affichage, `pdf-lib` pour l'export).

## Développement local

```bash
npm install
npm run dev
```

## Déploiement

Le site se déploie automatiquement sur GitHub Pages à chaque push sur `main` via GitHub Actions.

**URL :** https://poubone.github.io/pdf_editor/

### Configuration GitHub Pages

Dans les paramètres du dépôt → **Pages** → Source : **GitHub Actions**.

## Stack technique

- React + TypeScript + Vite
- [pdf.js](https://mozilla.github.io/pdf.js/) — rendu PDF
- [pdf-lib](https://pdf-lib.js.org/) — modification et export PDF

## Fonctionnalités futures possibles

- Rotation de pages
- Fusion / extraction de pages
- Surlignage de texte
- Réorganisation des pages
- Mode hors-ligne (PWA)
