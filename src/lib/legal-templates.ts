export type LegalTemplate={title:string;sections:{title:string;fields:{key:string;label:string}[];checks:{key:string;label:string}[]}[]};
export const legalTemplates:Record<string,LegalTemplate>={
  "JUR-J01": {
    "title": "Examen juridique du dossier",
    "sections": [
      {
        "title": "Examen juridique du dossier",
        "fields": [
          {
            "key": "s0f0",
            "label": "Client ou société de projet et parcelles concernées"
          },
          {
            "key": "s0f1",
            "label": "Entité engageante emprunteur prêteur et éventuel garant"
          },
          {
            "key": "s0f2",
            "label": "Objet montant devise durée et référence de l’offre"
          },
          {
            "key": "s0f3",
            "label": "Version de l’acte examiné et date limite de réponse"
          },
          {
            "key": "s0f4",
            "label": "Recherches officielles autorité date et références des pièces"
          },
          {
            "key": "s0f5",
            "label": "Pièce ou contrôle non applicable et motif"
          },
          {
            "key": "s0f6",
            "label": "Acte examiné :  /  Transmission   /  Crédit   /  Garantie   /  Hypothèque  /  Avenant   /  Recours   /  Autre :"
          }
        ],
        "checks": [
          {
            "key": "s0c0",
            "label": "Identité capacité représentants pouvoirs et consentements requis vérifiés."
          },
          {
            "key": "s0c1",
            "label": "Qualification de l’activité et habilitation des acteurs examinées."
          },
          {
            "key": "s0c2",
            "label": "Origine propriété et affectation des ressources établies."
          },
          {
            "key": "s0c3",
            "label": "Conflits déclarés et mandat du Cabinet identifié."
          },
          {
            "key": "s0c4",
            "label": "Chaîne des droits titre mère contrats et individualisation vérifiés."
          },
          {
            "key": "s0c5",
            "label": "Charges litiges inscriptions et droits concurrents recherchés officiellement."
          },
          {
            "key": "s0c6",
            "label": "Nature durée du droit et admissibilité du titulaire examinées."
          },
          {
            "key": "s0c7",
            "label": "Sûreté possible formalités rang et devise identifiés."
          }
        ]
      },
      {
        "title": "Réserves et conclusion du Cabinet",
        "fields": [
          {
            "key": "s1f0",
            "label": "Fondements juridiques articles et date de vérification"
          },
          {
            "key": "s1f1",
            "label": "Acte autorisable limites et durée de validité de l’avis"
          },
          {
            "key": "s1f2",
            "label": "Motifs et références des preuves de levée des réserves"
          },
          {
            "key": "s1f3",
            "label": "Événement imposant une nouvelle revue"
          },
          {
            "key": "s1f4",
            "label": "Identité qualité date et signature ou visa"
          },
          {
            "key": "s1f5",
            "label": "Référence Docusign ou journal de validation et PDF conservé"
          },
          {
            "key": "s1f6",
            "label": "Réserves à lever — Réserve ou pièce ; acte bloqué ; responsable ; échéance"
          },
          {
            "key": "s1f7",
            "label": "Conclusion :  /  Favorable pour l’acte indiqué   /  Sous conditions  /  Défavorable   /  Examen complémentaire requis"
          }
        ],
        "checks": [
          {
            "key": "s1c0",
            "label": "Coût périmètre durée appels modifications et sortie examinés."
          },
          {
            "key": "s1c1",
            "label": "Risques et recours expliqués ou notice à remettre identifiée."
          },
          {
            "key": "s1c2",
            "label": "Destinataires des données et autorisation ciblée vérifiés."
          },
          {
            "key": "s1c3",
            "label": "Mode de signature et formalités de preuve admissibles examinés."
          },
          {
            "key": "s1c4",
            "label": "Délais et obligations de suivi affectés à un responsable."
          }
        ]
      }
    ]
  },
  "JUR-J02": {
    "title": "Exposition et ressources de garantie",
    "sections": [
      {
        "title": "Exposition et ressources de garantie",
        "fields": [
          {
            "key": "s0f0",
            "label": "Prêt institution bénéficiaire et constituant exacts"
          },
          {
            "key": "s0f1",
            "label": "Principal intérêts accessoires et plafond global tout compris"
          },
          {
            "key": "s0f2",
            "label": "Quotité assiette partage proportionnel ou premières pertes"
          },
          {
            "key": "s0f3",
            "label": "Lien avec les autres garanties couvrant la même dette"
          },
          {
            "key": "s0f4",
            "label": "Date périmètre des comptes taux de conversion et source"
          },
          {
            "key": "s0f5",
            "label": "Trésorerie à la date de décision — Trésorerie propre totale ; cash déjà bloqué ; liquidité libre initiale ; réserve minimale ; nouveau blocage ; engagements non financés ; appels non couverts ; liquidité résiduelle. Pour chaque ligne : montant, devise et preuve datée."
          },
          {
            "key": "s0f6",
            "label": "Instrument :  /  Caution   /  Compte nanti   /  Transfert fiduciaire  /  Garantie autonome à examiner   /  Autre :"
          }
        ],
        "checks": []
      },
      {
        "title": "Analyse et validations de l’exposition",
        "fields": [
          {
            "key": "s1f0",
            "label": "Offres comparées avec et sans soutien et dates"
          },
          {
            "key": "s1f1",
            "label": "Gain client démontré frais et coût du blocage"
          },
          {
            "key": "s1f2",
            "label": "Plafonds par client institution et portefeuille avant et après"
          },
          {
            "key": "s1f3",
            "label": "Date de revue réduction prévue et conditions de restitution"
          },
          {
            "key": "s1f4",
            "label": "Hypothèses et perte maximale du scénario défavorable"
          },
          {
            "key": "s1f5",
            "label": "Mesures proposées et limites restant à fixer"
          },
          {
            "key": "s1f6",
            "label": "Préparateur date et référence des calculs"
          },
          {
            "key": "s1f7",
            "label": "Contrôleur distinct conclusion et date"
          },
          {
            "key": "s1f8",
            "label": "Avis du Cabinet sur instrument ressources et limites"
          },
          {
            "key": "s1f9",
            "label": "Identité qualité date et signature ou visa"
          },
          {
            "key": "s1f10",
            "label": "Référence Docusign ou journal de validation et PDF conservé"
          },
          {
            "key": "s1f11",
            "label": "Avis Finance :  /  Soutenable   /  À modifier   /  Non soutenable"
          }
        ],
        "checks": [
          {
            "key": "s1c0",
            "label": "Défauts simultanés et montant maximal mobilisable examinés."
          },
          {
            "key": "s1c1",
            "label": "Retard du titre chantier inachevé et variation de change examinés."
          },
          {
            "key": "s1c2",
            "label": "Aucun fonds client ni ressource affectée à un autre objet détourné."
          },
          {
            "key": "s1c3",
            "label": "Absence de double emploi du cash et de double comptage des garanties vérifiée."
          },
          {
            "key": "s1c4",
            "label": "Disponibilité réelle de la ressource établie sans compter une vente future."
          }
        ]
      }
    ]
  },
  "JUR-J03": {
    "title": "Remise et garde des originaux",
    "sections": [
      {
        "title": "Remise et garde des originaux",
        "fields": [
          {
            "key": "s0f0",
            "label": "Remettant identité qualité et pouvoirs"
          },
          {
            "key": "s0f1",
            "label": "Dépositaire entité représentant et coordonnées vérifiées"
          },
          {
            "key": "s0f2",
            "label": "Motif fondement de la garde et destinataire autorisé"
          },
          {
            "key": "s0f3",
            "label": "Lieu sécurisé responsable et personnes habilitées à accéder"
          },
          {
            "key": "s0f4",
            "label": "Événement ou date de restitution et personne destinataire"
          },
          {
            "key": "s0f5",
            "label": "Procédure de perte détérioration ou désaccord communiquée"
          },
          {
            "key": "s0f6",
            "label": "Date heure lieu et observations contradictoires"
          },
          {
            "key": "s0f7",
            "label": "Nom qualité et signature du remettant"
          },
          {
            "key": "s0f8",
            "label": "Nom qualité et signature du dépositaire"
          },
          {
            "key": "s0f9",
            "label": "Inventaire contradictoire — Nature de la pièce ; référence ; date ; parcelle ; nombre de pages ; état"
          }
        ],
        "checks": [
          {
            "key": "s0c0",
            "label": "Copie complète et reçu de dépôt remis au remettant."
          },
          {
            "key": "s0c1",
            "label": "Authenticité et portée de chaque pièce examinées séparément."
          }
        ]
      },
      {
        "title": "Mouvements et restitution des originaux",
        "fields": [
          {
            "key": "s1f0",
            "label": "Pièces concernées références et état constaté"
          },
          {
            "key": "s1f1",
            "label": "Destinataire identité qualité et pouvoirs"
          },
          {
            "key": "s1f2",
            "label": "Fondement de la transmission et autorisation de la personne compétente"
          },
          {
            "key": "s1f3",
            "label": "Date heure lieu et transporteur éventuel"
          },
          {
            "key": "s1f4",
            "label": "Retour attendu ou événement de restitution"
          },
          {
            "key": "s1f5",
            "label": "Référence du reçu de remise ou accusé de réception"
          },
          {
            "key": "s1f6",
            "label": "Écarts réserves incident FIN-F08 lié et action attendue"
          },
          {
            "key": "s1f7",
            "label": "Détenteur actuel et lieu de conservation mis à jour"
          },
          {
            "key": "s1f8",
            "label": "Nom qualité date et signature de la personne qui remet"
          },
          {
            "key": "s1f9",
            "label": "Nom qualité date et signature de la personne qui reçoit"
          },
          {
            "key": "s1f10",
            "label": "Référence Docusign ou preuve papier et PDF conservé"
          },
          {
            "key": "s1f11",
            "label": "Événement :  /  Sortie temporaire   /  Transmission autorisée  /  Restitution définitive   /  Perte ou détérioration signalée"
          }
        ],
        "checks": [
          {
            "key": "s1c0",
            "label": "Identité du destinataire vérifiée par un canal fiable."
          },
          {
            "key": "s1c1",
            "label": "Inventaire comparé à la remise initiale ; écarts documentés."
          },
          {
            "key": "s1c2",
            "label": "Droits de garde et conditions de restitution respectés."
          },
          {
            "key": "s1c3",
            "label": "Copie de la preuve conservée et personnes concernées informées."
          }
        ]
      }
    ]
  },
  "JUR-J04": {
    "title": "Autorisation conjointe avant engagement",
    "sections": [
      {
        "title": "Autorisation conjointe avant engagement",
        "fields": [
          {
            "key": "s0f0",
            "label": "Entité engageante contrepartie et bénéficiaire"
          },
          {
            "key": "s0f1",
            "label": "Acte version dette couverte montant devise et plafond cumulé"
          },
          {
            "key": "s0f2",
            "label": "Période couverte et date limite de signature"
          },
          {
            "key": "s0f3",
            "label": "Organe compétent référence des statuts et pouvoirs"
          },
          {
            "key": "s0f4",
            "label": "Avis motivé responsable Finance date et référence"
          },
          {
            "key": "s0f5",
            "label": "Avis motivé Cabinet date et référence"
          },
          {
            "key": "s0f6",
            "label": "Organe compétent décision datée et procès verbal joint"
          },
          {
            "key": "s0f7",
            "label": "Représentants habilités et limites de leur mandat"
          },
          {
            "key": "s0f8",
            "label": "Décision de l’organe : autorisé dans les limites décrites / ajourné / refusé"
          }
        ],
        "checks": [
          {
            "key": "s0c0",
            "label": "JUR-J02 complète et rapprochée du registre des engagements."
          },
          {
            "key": "s0c1",
            "label": "Ressource disponible plafonds et liquidité suffisante vérifiés."
          },
          {
            "key": "s0c2",
            "label": "Avantage client et coût du soutien examinés."
          },
          {
            "key": "s0c3",
            "label": "JUR-J01 et version définitive de l’acte examinées."
          },
          {
            "key": "s0c4",
            "label": "Capacité intérêt social pouvoirs consentements et conflits contrôlés."
          },
          {
            "key": "s0c5",
            "label": "Appels recours avenants et sortie encadrés."
          },
          {
            "key": "s0c6",
            "label": "Conditions bloquantes levées ou condition suspensive valable rédigée."
          }
        ]
      },
      {
        "title": "Constitution et contrôle après signature",
        "fields": [
          {
            "key": "s1f0",
            "label": "Acte signé version date et signataires réels"
          },
          {
            "key": "s1f1",
            "label": "Mode de signature et preuve de son admissibilité"
          },
          {
            "key": "s1f2",
            "label": "Conditions de prise d’effet clause et preuve attendue"
          },
          {
            "key": "s1f3",
            "label": "Date de prise d’effet juridique et fondement"
          },
          {
            "key": "s1f4",
            "label": "État de l’opposabilité et réserves restantes"
          },
          {
            "key": "s1f5",
            "label": "Incidence de toute anomalie et mesures du Cabinet"
          },
          {
            "key": "s1f6",
            "label": "Responsable du suivi suppléant et prochaine échéance"
          },
          {
            "key": "s1f7",
            "label": "Identité qualité date et signature ou visa"
          },
          {
            "key": "s1f8",
            "label": "Référence Docusign ou journal de validation et PDF conservé"
          },
          {
            "key": "s1f9",
            "label": "Formalités à suivre séparément — Formalité ; autorité ; responsable ; échéance ; preuve ; date réelle"
          }
        ],
        "checks": [
          {
            "key": "s1c0",
            "label": "Acte signé identique à celui autorisé ou réexaminé après modification."
          },
          {
            "key": "s1c1",
            "label": "Plafonds dates notifications et échéances inscrits au registre."
          },
          {
            "key": "s1c2",
            "label": "Publicité notification rang et renouvellement contrôlés selon le cas."
          }
        ]
      }
    ]
  },
  "JUR-J05": {
    "title": "Appel en garantie et recours",
    "sections": [
      {
        "title": "Appel en garantie et recours",
        "fields": [
          {
            "key": "s0f0",
            "label": "Garantie prêt débiteur créancier et référence de l’appel"
          },
          {
            "key": "s0f1",
            "label": "Réception date heure canal et personne ayant reçu"
          },
          {
            "key": "s0f2",
            "label": "Délai applicable fondement point de départ et échéance calculée"
          },
          {
            "key": "s0f3",
            "label": "Responsable Cabinet suppléant et alerte envoyée à"
          },
          {
            "key": "s0f4",
            "label": "Montant réclamé devise et décompte détaillé"
          },
          {
            "key": "s0f5",
            "label": "Irrégularités motifs et montant contesté"
          },
          {
            "key": "s0f6",
            "label": "Notification de réponse date destinataire et preuve"
          },
          {
            "key": "s0f7",
            "label": "Instrument :  /  Caution   /  Garantie autonome   /  Sûreté sur espèces"
          }
        ],
        "checks": [
          {
            "key": "s0c0",
            "label": "Auteur bénéficiaire authenticité de l’appel et dette contrôlés."
          },
          {
            "key": "s0c1",
            "label": "Période objet et champ de l’engagement vérifiés."
          },
          {
            "key": "s0c2",
            "label": "Exigibilité notifications et pièces requises examinées."
          },
          {
            "key": "s0c3",
            "label": "Somme rapprochée avec paiements antérieurs et autres réalisations."
          },
          {
            "key": "s0c4",
            "label": "Plafond intérêts frais et contestations examinés."
          },
          {
            "key": "s0c5",
            "label": "Débiteur avisé ou mis en cause lorsque requis ; preuve conservée."
          },
          {
            "key": "s0c6",
            "label": "Recours subrogation et conservation des sûretés examinés."
          }
        ]
      },
      {
        "title": "Décision règlement et recours",
        "fields": [
          {
            "key": "s1f0",
            "label": "Montant reconnu montant contesté devise et motifs"
          },
          {
            "key": "s1f1",
            "label": "Validation Finance Cabinet et autorité habilitée"
          },
          {
            "key": "s1f2",
            "label": "Instruction transmise aux seuls signataires bancaires hors site"
          },
          {
            "key": "s1f3",
            "label": "Date montant devise référence bancaire et bénéficiaire vérifié"
          },
          {
            "key": "s1f4",
            "label": "Contrôleur bancaire distinct date et preuve rapprochée"
          },
          {
            "key": "s1f5",
            "label": "Quittance décompte actualisé et pièces de recours reçues"
          },
          {
            "key": "s1f6",
            "label": "Solde prêteur solde de recours et couverture restante"
          },
          {
            "key": "s1f7",
            "label": "Fondement du recours actes et formalités nécessaires"
          },
          {
            "key": "s1f8",
            "label": "Mesures de conservation responsable suppléant et échéance"
          },
          {
            "key": "s1f9",
            "label": "Information au débiteur et preuve de transmission"
          },
          {
            "key": "s1f10",
            "label": "Récupérations reçues par banque affectation et soldes actualisés"
          },
          {
            "key": "s1f11",
            "label": "Identité qualité date et signature ou visa"
          },
          {
            "key": "s1f12",
            "label": "Référence Docusign ou journal de validation et PDF conservé"
          },
          {
            "key": "s1f13",
            "label": "Avis juridique :  /  Conforme   /  Partiellement fondé   /  Contesté"
          }
        ],
        "checks": [
          {
            "key": "s1c0",
            "label": "Aucune fraction déjà payée réclamée deux fois au débiteur."
          },
          {
            "key": "s1c1",
            "label": "Créance résiduelle et frais éventuels justifiés séparément."
          }
        ]
      }
    ]
  },
  "JUR-J06": {
    "title": "Réduction libération et clôture",
    "sections": [
      {
        "title": "Réduction libération et clôture",
        "fields": [
          {
            "key": "s0f0",
            "label": "Prêt garantie constituant créancier et parties concernées"
          },
          {
            "key": "s0f1",
            "label": "Décompte bancaire daté clause ou fondement de libération"
          },
          {
            "key": "s0f2",
            "label": "Montant à libérer devise plafond avant et après"
          },
          {
            "key": "s0f3",
            "label": "Sûreté inscription rang et formalité attendue"
          },
          {
            "key": "s0f4",
            "label": "Autorité ou bénéficiaire devant consentir la libération"
          },
          {
            "key": "s0f5",
            "label": "Acte de libération demandé date et réponse obtenue"
          },
          {
            "key": "s0f6",
            "label": "Formalité accomplie preuve officielle et date"
          },
          {
            "key": "s0f7",
            "label": "Obligation encore ouverte responsable et échéance"
          },
          {
            "key": "s0f8",
            "label": "Motif :  /  Amortissement   /  Remboursement anticipé   /  Substitution  /  Non décaissement   /  Clôture   /  Autre :"
          }
        ],
        "checks": [
          {
            "key": "s0c0",
            "label": "Événement prévu réalisé et preuves vérifiées."
          },
          {
            "key": "s0c1",
            "label": "Prêteur et autres ayants droit concernés identifiés."
          },
          {
            "key": "s0c2",
            "label": "Recours et créances résiduelles de Plate-Forme pris en compte."
          },
          {
            "key": "s0c3",
            "label": "Nouvelle sûreté constituée si la libération dépend d’une substitution."
          },
          {
            "key": "s0c4",
            "label": "Consentements actes de mainlevée et formalités identifiés."
          }
        ]
      },
      {
        "title": "Restitution et clôture effective",
        "fields": [
          {
            "key": "s1f0",
            "label": "Référence bancaire montant devise date et contrôleur distinct"
          },
          {
            "key": "s1f1",
            "label": "Espèces libérées espèces encore bloquées et justification"
          },
          {
            "key": "s1f2",
            "label": "Solde bancaire dette de recours et engagements maintenus"
          },
          {
            "key": "s1f3",
            "label": "Originaux restitués référence du reçu JUR-J03 et date"
          },
          {
            "key": "s1f4",
            "label": "Actes de mainlevée radiation et autres pièces finales"
          },
          {
            "key": "s1f5",
            "label": "Information remise au membre et documents communicables"
          },
          {
            "key": "s1f6",
            "label": "Conservation du dossier durée retenue et gel éventuel pour litige"
          },
          {
            "key": "s1f7",
            "label": "Éléments restant ouverts et prochaine échéance"
          },
          {
            "key": "s1f8",
            "label": "Identité qualité date et signature ou visa"
          },
          {
            "key": "s1f9",
            "label": "Référence Docusign ou journal de validation et PDF conservé"
          },
          {
            "key": "s1f10",
            "label": "État :  /  Réduction effectuée   /  Clôture complète   /  Clôture partielle"
          }
        ],
        "checks": [
          {
            "key": "s1c0",
            "label": "Sommes effectivement restituées par banque et rapprochées."
          },
          {
            "key": "s1c1",
            "label": "Intérêts frais et écarts justifiés."
          },
          {
            "key": "s1c2",
            "label": "Pas de réemploi des fonds ni nouvelle garantie sans décision autorisée."
          },
          {
            "key": "s1c3",
            "label": "Registres financiers et juridiques rapprochés sans effacer l’historique."
          }
        ]
      }
    ]
  },
  "JUR-J07": {
    "title": "Information du membre",
    "sections": [
      {
        "title": "Information du membre",
        "fields": [
          {
            "key": "s0f0",
            "label": "Membre interlocuteur date langue et parcelles concernées"
          },
          {
            "key": "s0f1",
            "label": "Prêteur montant net devise durée et objet"
          },
          {
            "key": "s0f2",
            "label": "Référence date de validité et version de l’offre"
          },
          {
            "key": "s0f3",
            "label": "Échéance méthode du taux frais assurance et coût total"
          },
          {
            "key": "s0f4",
            "label": "Garanties exigées biens exposés et formalités"
          },
          {
            "key": "s0f5",
            "label": "Soutien envisagé de Plate-Forme plafond durée et recours"
          },
          {
            "key": "s0f6",
            "label": "Documents remis tarifs échéancier conditions et notices"
          },
          {
            "key": "s0f7",
            "label": "Points non applicables ou restant à expliquer"
          }
        ],
        "checks": [
          {
            "key": "s0c0",
            "label": "Le prêteur prend sa décision de crédit selon son analyse."
          },
          {
            "key": "s0c1",
            "label": "La simulation générale précède une étude et une offre individualisées."
          },
          {
            "key": "s0c2",
            "label": "La demande de financement et la commande ont des conditions distinctes."
          },
          {
            "key": "s0c3",
            "label": "Paiements et remboursements sont exclusivement bancaires hors site."
          },
          {
            "key": "s0c4",
            "label": "La garde du contrat original ne crée pas à elle seule une hypothèque."
          },
          {
            "key": "s0c5",
            "label": "La mise en valeur ne garantit pas automatiquement un titre."
          },
          {
            "key": "s0c6",
            "label": "Un paiement de Plate-Forme comme caution peut entraîner un recours."
          },
          {
            "key": "s0c7",
            "label": "Les biens valablement engagés peuvent être exposés en cas d’impayé."
          }
        ]
      },
      {
        "title": "Questions et confirmation de l’information",
        "fields": [
          {
            "key": "s1f0",
            "label": "Question du membre et réponse apportée"
          },
          {
            "key": "s1f1",
            "label": "Question restant ouverte responsable et date de réponse"
          },
          {
            "key": "s1f2",
            "label": "Canal de réclamation coordonnées et référence FIN-F08 si utile"
          },
          {
            "key": "s1f3",
            "label": "Interprète ou accompagnant éventuel identité et rôle"
          },
          {
            "key": "s1f4",
            "label": "Identité qualité date et signature du membre ou représentant"
          },
          {
            "key": "s1f5",
            "label": "Identité qualité date et visa de l’intervenant"
          },
          {
            "key": "s1f6",
            "label": "Référence Docusign ou mode approuvé et PDF remis au membre"
          },
          {
            "key": "s1f7",
            "label": "Suite souhaitée :  /  Poursuivre l’étude   /  Demander une explication  /  Revoir le projet   /  Différer   /  Ne pas poursuivre"
          }
        ],
        "checks": [
          {
            "key": "s1c0",
            "label": "Coûts change retard de travaux et alternatives examinés."
          },
          {
            "key": "s1c1",
            "label": "Conditions de réduction et restitution des garanties expliquées."
          },
          {
            "key": "s1c2",
            "label": "Risques de retard de paiement et interlocuteurs présentés."
          },
          {
            "key": "s1c3",
            "label": "Conseil indépendant et canaux de réclamation indiqués."
          }
        ]
      }
    ]
  }
};
