# Basculement : l'ancienne adresse renvoie vers le portail

Ancienne adresse : https://rayanem-dev.github.io/DashBoard-Infra/
Nouvelle adresse : https://rayanem-dev.github.io/DashBoard-Infra-v2/connexion.html

## Avant de basculer (tout doit être « oui »)
- [ ] `verifierSourcesDonnees` affiche OK pour cpm, forage, terrassement, electricite
- [ ] Le portail affiche les chiffres CPM et chantiers, feuilles passées en « Restreint »
- [ ] Suivi CPM V5 partagé avec rayanem@gmail.com et infracpm@gmail.com
- [ ] Les agents ont reçu le message ci-dessous (au moins 2 jours avant)
- [ ] Les fichiers Drive sont rangés (voir INVENTAIRE-FICHIERS-DRIVE.md)

## Message aux agents (court)
**Objet : Nouveau portail de la Division Infrastructure**

Bonjour,

Le tableau de bord de la division a changé : il s'ouvre maintenant avec votre nom et un mot de passe.

1. Ouvrez : https://rayanem-dev.github.io/DashBoard-Infra-v2/connexion.html
2. Tapez votre nom, puis le mot de passe provisoire **0000** (vous le changerez ensuite).
3. Indiquez où vous en êtes dans votre planning de travail et de repos : c'est demandé une seule fois.

Vous retrouvez vos applications, votre planning, l'annuaire téléphonique et les nouveautés. L'ancienne adresse enverra automatiquement vers le nouveau portail à partir du [DATE].

En cas de problème : sec.infra.rns@gmail.com

Cordialement,
MADANI Rayane — Secrétariat de la Division Infrastructure

## Le jour J : remplacer `index.html` de l'ANCIEN dépôt par la page ci-dessous
(les autres fichiers de l'ancien dépôt restent intacts ; pour revenir en arrière, il suffit de remettre l'ancien `index.html`)

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=https://rayanem-dev.github.io/DashBoard-Infra-v2/connexion.html">
<title>Le tableau de bord a changé d'adresse</title>
<script>location.replace('https://rayanem-dev.github.io/DashBoard-Infra-v2/connexion.html');</script>
<style>body{font-family:Arial,sans-serif;background:#F5F5F0;color:#1A1A2E;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}a{color:#E85D04;font-weight:700}</style>
</head>
<body>
<div>
  <h1>Le tableau de bord a changé d'adresse</h1>
  <p>Vous êtes redirigé vers le nouveau portail de la Division Infrastructure.</p>
  <p><a href="https://rayanem-dev.github.io/DashBoard-Infra-v2/connexion.html">Cliquez ici si rien ne se passe</a></p>
</div>
</body>
</html>
```
Les anciennes pages secondaires (Avancement_des_Chantiers.html, Suivi_Chantier.html, Dossiers_CPM.html…) du vieux dépôt lisent encore les feuilles : une fois les feuilles privées, elles n'afficheront plus rien. Il faudra aussi les remplacer par la même redirection (une page de redirection par nom de fichier).
