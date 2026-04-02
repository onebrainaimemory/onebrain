import type { FastifyInstance, FastifyRequest } from 'fastify';
import { success } from '../lib/response.js';

/**
 * GET /v1/legal/dpa — Returns DPA (Data Processing Agreement) text.
 * No auth required. Content varies by locale query param.
 */
export async function legalRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/legal/dpa',
    async (
      request: FastifyRequest<{
        Querystring: { locale?: string };
      }>,
      reply,
    ) => {
      const locale = request.query.locale ?? 'en';
      const dpa = getDpaContent(locale);

      return reply.status(200).send(success(dpa));
    },
  );
}

interface DpaSection {
  title: string;
  content: string;
}

interface DpaDocument {
  title: string;
  lastUpdated: string;
  sections: DpaSection[];
}

function getDpaContent(locale: string): DpaDocument {
  const dpaMap: Record<string, DpaDocument> = {
    de: buildDpaDe(),
    en: buildDpaEn(),
    es: buildDpaEs(),
  };

  return dpaMap[locale] ?? dpaMap['en']!;
}

function buildDpaEn(): DpaDocument {
  return {
    title: 'Data Processing Agreement (DPA)',
    lastUpdated: '2026-03-20T00:00:00Z',
    sections: [
      {
        title: 'Processing Purposes',
        content:
          'The processor processes personal data on behalf of ' +
          'the controller solely for the purpose of providing ' +
          'the OneBrain AI memory layer service, including: ' +
          'user authentication, memory storage and retrieval, ' +
          'AI context delivery, and billing management.',
      },
      {
        title: 'Data Categories',
        content:
          'The following categories of personal data are processed: ' +
          'email addresses, user-generated memory content, ' +
          'usage metadata (timestamps, token counts), ' +
          'payment references (Stripe Customer ID), and ' +
          'session/authentication data.',
      },
      {
        title: 'Data Subjects',
        content:
          'Data subjects are registered users of the OneBrain ' +
          'service who create accounts and store personal memories.',
      },
      {
        title: 'Security Measures',
        content:
          'Technical measures: TLS encryption in transit, ' +
          'database encryption at rest, parameterized queries, ' +
          'JWT-based authentication with short-lived tokens, ' +
          'rate limiting, and CORS protection. ' +
          'Organizational measures: access logging, audit trails, ' +
          'automated data retention cleanup, and regular security reviews.',
      },
      {
        title: 'Sub-Processors',
        content:
          'The following sub-processors may be used: ' +
          'Hetzner Online GmbH (infrastructure hosting, Germany), ' +
          'Stripe Inc. (payment processing, USA with EU SCCs). ' +
          'The controller will be notified of any changes to sub-processors.',
      },
      {
        title: 'Data Subject Rights',
        content:
          'The processor assists the controller in fulfilling ' +
          'data subject rights including: right of access (Art. 15 GDPR), ' +
          'right to rectification (Art. 16), right to erasure (Art. 17), ' +
          'right to data portability (Art. 20), and ' +
          'right to restriction of processing (Art. 18). ' +
          'Data export and deletion endpoints are provided via the API.',
      },
      {
        title: 'Duration and Termination',
        content:
          'This agreement is effective for the duration of the service ' +
          'contract. Upon termination, all personal data is deleted ' +
          'within 30 days, except where retention is required by law.',
      },
    ],
  };
}

function buildDpaDe(): DpaDocument {
  return {
    title: 'Auftragsverarbeitungsvertrag (AVV)',
    lastUpdated: '2026-03-20T00:00:00Z',
    sections: [
      {
        title: 'Verarbeitungszwecke',
        content:
          'Der Auftragsverarbeiter verarbeitet personenbezogene Daten ' +
          'im Auftrag des Verantwortlichen ausschliesslich zum Zweck ' +
          'der Bereitstellung des OneBrain KI-Gedaechtnis-Dienstes: ' +
          'Benutzerauthentifizierung, Speicherung und Abruf von ' +
          'Erinnerungen, KI-Kontextbereitstellung und Abrechnungsverwaltung.',
      },
      {
        title: 'Datenkategorien',
        content:
          'Folgende Kategorien personenbezogener Daten werden verarbeitet: ' +
          'E-Mail-Adressen, nutzergenerierte Erinnerungsinhalte, ' +
          'Nutzungsmetadaten (Zeitstempel, Token-Zaehler), ' +
          'Zahlungsreferenzen (Stripe-Kunden-ID) und ' +
          'Sitzungs-/Authentifizierungsdaten.',
      },
      {
        title: 'Betroffene Personen',
        content:
          'Betroffene Personen sind registrierte Nutzer des OneBrain-Dienstes, ' +
          'die Konten erstellen und persoenliche Erinnerungen speichern.',
      },
      {
        title: 'Sicherheitsmassnahmen',
        content:
          'Technische Massnahmen: TLS-Verschluesselung bei der Uebertragung, ' +
          'Datenbankverschluesselung im Ruhezustand, parametrisierte Abfragen, ' +
          'JWT-basierte Authentifizierung mit kurzlebigen Token, ' +
          'Ratenbegrenzung und CORS-Schutz. ' +
          'Organisatorische Massnahmen: Zugriffsprotokollierung, Audit-Trails, ' +
          'automatisierte Datenaufbewahrungsbereinigung und regelmaessige Sicherheitsueberpruefungen.',
      },
      {
        title: 'Unterauftragsverarbeiter',
        content:
          'Folgende Unterauftragsverarbeiter koennen eingesetzt werden: ' +
          'Hetzner Online GmbH (Infrastruktur-Hosting, Deutschland), ' +
          'Stripe Inc. (Zahlungsabwicklung, USA mit EU-Standardvertragsklauseln). ' +
          'Der Verantwortliche wird ueber Aenderungen bei Unterauftragsverarbeitern informiert.',
      },
      {
        title: 'Betroffenenrechte',
        content:
          'Der Auftragsverarbeiter unterstuetzt den Verantwortlichen bei der ' +
          'Erfuellung der Betroffenenrechte: Auskunftsrecht (Art. 15 DSGVO), ' +
          'Berichtigungsrecht (Art. 16), Loeschrecht (Art. 17), ' +
          'Recht auf Datenuebertragbarkeit (Art. 20) und ' +
          'Recht auf Einschraenkung der Verarbeitung (Art. 18). ' +
          'Datenexport- und Loeschendpunkte stehen ueber die API zur Verfuegung.',
      },
      {
        title: 'Laufzeit und Beendigung',
        content:
          'Dieser Vertrag gilt fuer die Dauer des Dienstleistungsvertrags. ' +
          'Bei Beendigung werden alle personenbezogenen Daten innerhalb von ' +
          '30 Tagen geloescht, sofern keine gesetzliche Aufbewahrungspflicht besteht.',
      },
    ],
  };
}

function buildDpaEs(): DpaDocument {
  return {
    title: 'Acuerdo de Procesamiento de Datos (DPA)',
    lastUpdated: '2026-03-20T00:00:00Z',
    sections: [
      {
        title: 'Fines del procesamiento',
        content:
          'El encargado del tratamiento procesa datos personales en nombre ' +
          'del responsable exclusivamente para proporcionar el servicio ' +
          'de capa de memoria IA OneBrain: autenticacion de usuarios, ' +
          'almacenamiento y recuperacion de recuerdos, entrega de contexto ' +
          'de IA y gestion de facturacion.',
      },
      {
        title: 'Categorias de datos',
        content:
          'Se procesan las siguientes categorias de datos personales: ' +
          'direcciones de correo electronico, contenido de recuerdos ' +
          'generado por el usuario, metadatos de uso (marcas de tiempo, ' +
          'contadores de tokens), referencias de pago (ID de cliente Stripe) ' +
          'y datos de sesion/autenticacion.',
      },
      {
        title: 'Interesados',
        content:
          'Los interesados son usuarios registrados del servicio OneBrain ' +
          'que crean cuentas y almacenan recuerdos personales.',
      },
      {
        title: 'Medidas de seguridad',
        content:
          'Medidas tecnicas: cifrado TLS en transito, cifrado de base de datos ' +
          'en reposo, consultas parametrizadas, autenticacion basada en JWT ' +
          'con tokens de corta duracion, limitacion de velocidad y proteccion CORS. ' +
          'Medidas organizativas: registro de acceso, pistas de auditoria, ' +
          'limpieza automatizada de retencion de datos y revisiones de seguridad periodicas.',
      },
      {
        title: 'Subencargados',
        content:
          'Se pueden utilizar los siguientes subencargados: ' +
          'Hetzner Online GmbH (alojamiento de infraestructura, Alemania), ' +
          'Stripe Inc. (procesamiento de pagos, EE.UU. con CCE de la UE). ' +
          'El responsable sera notificado de cualquier cambio en los subencargados.',
      },
      {
        title: 'Derechos de los interesados',
        content:
          'El encargado asiste al responsable en el cumplimiento de los derechos ' +
          'de los interesados: derecho de acceso (Art. 15 RGPD), derecho de ' +
          'rectificacion (Art. 16), derecho de supresion (Art. 17), derecho a la ' +
          'portabilidad de datos (Art. 20) y derecho a la limitacion del ' +
          'tratamiento (Art. 18). Se proporcionan endpoints de exportacion ' +
          'y eliminacion de datos a traves de la API.',
      },
      {
        title: 'Duracion y terminacion',
        content:
          'Este acuerdo es efectivo durante la duracion del contrato de servicio. ' +
          'Tras la terminacion, todos los datos personales se eliminan en un plazo ' +
          'de 30 dias, salvo que la ley exija su conservacion.',
      },
    ],
  };
}
