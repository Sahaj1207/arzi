// The 7 facts Arzi collects for a deposit notice, in the order it asks for them.
// `type` decides which parser reads the answer and how it is shown and read back.
// `advocateLabel` is the wording on the advocate's desk; `label` is the citizen's.
// Telugu (te) text is awaiting review by a Telugu speaker: see docs/telugu-review.md.
export const FIELDS = [
  {
    id: 'tenantName',
    type: 'name',
    advocateLabel: 'Tenant name',
    label: { en: 'Your full name', hi: 'आपका पूरा नाम', mr: 'तुमचे पूर्ण नाव', te: 'మీ పూర్తి పేరు' },
    question: {
      en: 'What is your full name?',
      hi: 'आपका पूरा नाम क्या है?',
      mr: 'तुमचे पूर्ण नाव काय आहे?',
      te: 'మీ పూర్తి పేరు ఏమిటి?',
    },
  },
  {
    id: 'tenantAddress',
    type: 'address',
    advocateLabel: 'Tenant address',
    label: { en: 'Address of the rented place', hi: 'किराए के घर का पता', mr: 'भाड्याच्या घराचा पत्ता', te: 'అద్దె ఇంటి చిరునామా' },
    question: {
      en: 'What is the full address of the house or PG you rented?',
      hi: 'जिस घर या पीजी में आप किराए पर रहते थे, उसका पूरा पता बताइए।',
      mr: 'तुम्ही भाड्याने राहत होता त्या घराचा किंवा पीजीचा पूर्ण पत्ता सांगा.',
      te: 'మీరు అద్దెకు ఉన్న ఇల్లు లేదా పీజీ పూర్తి చిరునామా చెప్పండి.',
    },
  },
  {
    id: 'landlordName',
    type: 'name',
    advocateLabel: 'Landlord name',
    label: { en: 'Landlord / owner name', hi: 'मकान मालिक का नाम', mr: 'घरमालकाचे नाव', te: 'ఇంటి యజమాని పేరు' },
    question: {
      en: 'What is the full name of your landlord or PG owner?',
      hi: 'आपके मकान मालिक या पीजी मालिक का पूरा नाम क्या है?',
      mr: 'तुमच्या घरमालकाचे किंवा पीजी मालकाचे पूर्ण नाव काय आहे?',
      te: 'మీ ఇంటి యజమాని లేదా పీజీ యజమాని పూర్తి పేరు ఏమిటి?',
    },
  },
  {
    id: 'landlordAddress',
    type: 'address',
    advocateLabel: 'Landlord address',
    label: { en: 'Landlord address', hi: 'मकान मालिक का पता', mr: 'घरमालकाचा पत्ता', te: 'యజమాని చిరునామా' },
    question: {
      en: 'What is your landlord’s address? If it is the same building, say “same”.',
      hi: 'मकान मालिक का पता क्या है? अगर वही इमारत है तो “वही” बोलिए।',
      mr: 'घरमालकाचा पत्ता काय आहे? तीच इमारत असेल तर “तोच” म्हणा.',
      te: 'మీ ఇంటి యజమాని చిరునామా ఏమిటి? అదే భవనం అయితే “అదే” అని చెప్పండి.',
    },
  },
  {
    id: 'depositAmount',
    type: 'amount',
    advocateLabel: 'Deposit amount',
    label: { en: 'Deposit amount', hi: 'जमा राशि (डिपॉज़िट)', mr: 'अनामत रक्कम', te: 'డిపాజిట్ మొత్తం' },
    question: {
      en: 'How much security deposit did you pay, in rupees?',
      hi: 'आपने कितने रुपये सिक्योरिटी डिपॉज़िट दिया था?',
      mr: 'तुम्ही किती रुपये अनामत रक्कम दिली होती?',
      te: 'మీరు ఎన్ని రూపాయలు సెక్యూరిటీ డిపాజిట్ కట్టారు?',
    },
  },
  {
    id: 'movedOutDate',
    type: 'date',
    advocateLabel: 'Date vacated',
    label: { en: 'Date you moved out', hi: 'घर छोड़ने की तारीख', mr: 'घर सोडल्याची तारीख', te: 'ఇల్లు ఖాళీ చేసిన తేదీ' },
    question: {
      en: 'On what date did you move out?',
      hi: 'आपने किस तारीख को घर छोड़ा?',
      mr: 'तुम्ही कोणत्या तारखेला घर सोडले?',
      te: 'మీరు ఏ తేదీన ఇల్లు ఖాళీ చేశారు?',
    },
  },
  {
    id: 'dueDate',
    type: 'pending',
    advocateLabel: 'Pending since',
    label: { en: 'Deposit due since', hi: 'डिपॉज़िट कब से बाकी है', mr: 'रक्कम कधीपासून बाकी आहे', te: 'డిపాజిట్ ఎప్పటి నుంచి బాకీ' },
    question: {
      en: 'When was the deposit supposed to be returned? Or, for how long has it been pending?',
      hi: 'डिपॉज़िट कब तक लौटाना था? या कितने समय से बाकी है?',
      mr: 'अनामत रक्कम कधीपर्यंत परत मिळायला हवी होती? किंवा किती दिवसांपासून बाकी आहे?',
      te: 'డిపాజిట్ ఎప్పుడు తిరిగి ఇవ్వాల్సి ఉంది? లేదా ఎంత కాలంగా బాకీ ఉంది?',
    },
  },
];

export const FIELD_IDS = FIELDS.map((f) => f.id);
export const getField = (id) => FIELDS.find((f) => f.id === id) ?? null;

// Words meaning "same as my address" for the landlord-address question.
export const SAME_ADDRESS_WORDS = [
  'same', 'same address', 'wahi', 'vahi', 'वही', 'वही पता', 'तोच', 'तेच', 'सेम', 'అదే', 'అదే చిరునామా', 'సేమ్',
];
