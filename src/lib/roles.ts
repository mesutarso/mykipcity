export const staffRoles = { LEGAL_OFFICER:"Cabinet juridique", ADMIN: "Administrateur des accès", ACQUIRER_AGENT: "Gestionnaire acquéreurs", FINANCE_OFFICER: "Référent Finance", FINANCE_REVIEWER: "Contrôleur Finance", FINANCE_VALIDATOR: "Validateur Finance" } as const;
export function homeForRole(role:string){return role==="LEGAL_OFFICER"?"/juridique":role==="FINANCE_REVIEWER"||role==="FINANCE_VALIDATOR"?"/finance/controles":role==="ADMIN"?"/administration/equipe":role==="FINANCE_OFFICER"?"/finance":role==="ACQUIRER_AGENT"?"/gestion/acquereurs":"/mykipcity";}

export const financeStates:Record<string,string>={DRAFT:"À préparer",IN_REVIEW:"À contrôler",IN_VALIDATION:"À valider",INTERNALLY_VALIDATED:"Validation interne enregistrée"};
