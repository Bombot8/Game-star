GAMESTATS — VERSION 0.7

LANCER LE SITE
1. Installe Node.js 18 ou plus récent.
2. Décompresse gamestats_v07.zip.
3. Ouvre un terminal dans ce dossier.
4. Lance : npm start
5. Ouvre : http://localhost:3000

NOUVEAU — FORTNITE DATA API OFFICIELLE
- Recherche d’une île publique par code.
- Récupération des métadonnées et des métriques quotidiennes via l’API publique Epic Games.
- Indicateurs : joueurs uniques, parties jouées, minutes jouées, pic de joueurs simultanés, moyenne de minutes par joueur, favoris et recommandations lorsque disponibles.
- Les données sont agrégées au niveau de l’île ; elles ne donnent pas les statistiques personnelles d’un joueur.
- Seules les îles publiques et découvrables sont accessibles ; les valeurs peuvent être nulles si le seuil minimal de données n’est pas atteint. L’historique public est limité à 7 jours.

ROCKET LEAGUE
- Lecture des données de partie depuis la Stats API locale officielle (TCP 49123).
- Affiche désormais score d’équipe, buts, passes, tirs, arrêts, démolitions, touches, boost et vitesse lorsque les champs sont envoyés par le jeu.
- Active PacketSendRate dans TAStatsAPI.ini avant de démarrer Rocket League. La valeur par défaut est 0 (désactivé).
- Le fichier est dans <Install Dir>\TAGame\Config\TAStatsAPI.ini sous [TAGame.MatchStatsExporter_TA]. Le port TCP par défaut est 49123.

ROBLOX
- Recherche de profils publics et affichage des informations publiques et des expériences créées, selon disponibilité des services Roblox.

VALORANT
- Le top régional officiel nécessite une clé API Riot autorisée configurée côté serveur via RIOT_API_KEY.
- Les données personnelles nécessitent une application Riot approuvée et un consentement via Riot Sign On. Riot n’accorde pas de clé personnelle VALORANT ; les clés de production sont nécessaires pour RSO.
- Aucun mot de passe Riot ne doit être saisi dans GameStats.

LIMITES ET SÉCURITÉ
- Aucun rang ou résultat fictif n’est présenté comme réel.
- Les données de profil et résultats saisis manuellement restent dans le navigateur.
- Fortnite : cette intégration concerne les îles, pas le compte d’un joueur.
- Rocket League : la télémétrie est locale à l’ordinateur où le jeu tourne.
- Avant une mise en ligne publique : hébergement HTTPS, politique de confidentialité, tests de charge, sécurité et respect des conditions de chaque plateforme.

SOURCES OFFICIELLES
- Fortnite Data API : https://api.fortnite.com/ecosystem/v1/docs/
- Rocket League Stats API : https://www.rocketleague.com/developer/stats-api
- Riot Developer Portal : https://developer.riotgames.com/docs/valorant
