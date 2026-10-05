# Pilote MyKipCity — préparation du 5 octobre 2026

Domaine retenu par l’utilisateur : **https://my.kip-city.com**. Serveur cible encore à identifier. Aucun DNS, compte d’hébergement, certificat ni déploiement distant n’a été modifié. La configuration locale reste sur `http://127.0.0.1:3200`.

## Configuration et contrôles

Le modèle `deploy/pilot.env.example` contient le domaine et l’expéditeur, sans clé réelle. Les chemins `/srv/mykipcity/data/…` sont des exemples à adapter au disque persistant du serveur. L’application utilise une seule base SQLite locale ; ne pas la répartir entre plusieurs instances indépendantes ni utiliser un stockage éphémère.

`DEMO_MODE=true` reste obligatoire : le pilote décrit ici utilise des données fictives. Un mode Node `production` sert le code compilé et n’autorise pas, à lui seul, la collecte de vrais dossiers. L’antivirus, la quarantaine, la conservation et la revue avant ouverture réelle restent des travaux séparés.

Contrôler la machine locale :

```sh
bun run check:environment
```

Sur le futur serveur, après configuration privée, migration et compilation :

```sh
bun run check:environment --hosted
```

Le contrôle distant exige notamment HTTPS, des chemins absolus hors `public/`, le MFA et les e-mails activés. Il ne modifie aucun fichier et n’affiche aucune valeur secrète. Il ne peut pas prouver à lui seul la persistance du disque, la validité du certificat, les droits DNS, la disponibilité d’un antivirus ou la présence de sauvegardes externes.

## Ordre de mise en place sur le serveur choisi

1. Préparer un environnement séparé et un disque persistant pour SQLite et les documents. Installer les versions de Node/Bun prévues par le projet.
2. Récupérer le code que l’utilisateur aura poussé, installer avec `bun install --frozen-lockfile`, puis `bun run db:generate`.
3. Renseigner la configuration privée du serveur. Pour restaurer une copie de la base existante, conserver son secret Better Auth : il protège aussi les facteurs MFA et la file d’e-mails. Pour une installation neuve, générer un nouveau secret.
4. Sauvegarder l’état existant avant toute migration ; restaurer uniquement dans un nouveau répertoire. Exécuter `bun run db:migrate`, créer le dossier de documents privé si nécessaire, puis `bun run build`.
5. Configurer le service Node et un reverse proxy HTTPS pour `my.kip-city.com`. Le serveur Next écoute localement sur le port 3200 ; le proxy doit prendre en charge les dépôts contractuels pouvant atteindre 200 Mo et les délais associés.
6. Configurer le DNS et le certificat avec les accès du propriétaire du domaine. Désactiver tout cache partagé des pages privées et des téléchargements authentifiés.
7. Renseigner la clé Resend, activer `MAIL_ENABLED=true` et `MAIL_AUTORUN=true`, puis lancer le contrôle `--hosted`. Lancer et superviser le serveur pour que le traitement de la file reste actif.
8. Vérifier les connexions, les redirections, les fichiers privés et les e-mails sur l’URL réelle ; faire suivre la recette ci-dessous par les responsables.

Ne pas exposer sur Internet les comptes aux mots de passe de démonstration publiés dans le README. Utiliser un environnement de pilote à accès restreint et des comptes de pilote individuels avant de l’ouvrir aux participants.

## Recette à faire valider

Les tests techniques et le message Resend reçu ne constituent pas le procès-verbal client. Les lignes ci-dessous sont à compléter avec le responsable, la date, le résultat et une référence de preuve sans mot de passe ni lien secret.

| Scénario | Résultat attendu | État client |
| --- | --- | --- |
| Invitation | Bonne adresse, lien sur my.kip-city.com, expiration et usage unique | À exécuter |
| Récupération du compte | E-mail reçu, lien valide une fois, anciennes sessions fermées | À exécuter |
| MFA équipe | Enrôlement, connexion et code de secours ; accès refusé sans second facteur | À exécuter |
| Dossier et contrat multipage | Saisie conservée, pages ordonnées, version précédente accessible | À exécuter |
| Rattachement parcellaire | Agent examine la preuve ; membre consulte les seules parcelles autorisées | À exécuter |
| Complément et documents | Demande, dépôt, rejet/correction et acceptation visibles selon les droits | À exécuter |
| Contact | Message, pièce jointe, interlocuteur et réponse dans le bon dossier | À exécuter |
| Regroupement de comptes | Deux agents distincts, compte choisi conservé et deux dossiers accessibles | À exécuter |
| Changement de titulaire | Ancien accès retiré, nouveau accordé, archives privées séparées | À exécuter |
| Représentant | Mandat et échéance vérifiés ; consultation uniquement | À exécuter |
| Mobile | Sheet ouvert/fermé, navigation, notifications et sécurité accessibles | À exécuter |
| Rappels | Destinataire correct, pas de doublon quotidien, liens vers le domaine réel | À exécuter |
| Sauvegarde et restauration | Base et pièces intègres restaurées sur un emplacement distinct | À exécuter sur l’hôte |

Critère de réception : pas d’anomalie bloquante, résultats documentés, responsable acquéreurs identifié et accord explicite sur les réserves restantes. Aucun accord client n’est présumé.
