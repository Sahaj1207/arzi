// The 7 facts Arzi collects for a deposit notice, in the order it asks for them.
// `type` decides which parser reads the answer and how it is shown and read back.
export const FIELDS = [
  {
    id: 'tenantName',
    type: 'name',
    label: { en: 'Your full name', hi: 'आपका पूरा नाम', mr: 'तुमचे पूर्ण नाव' },
    question: {
      en: 'What is your full name?',
      hi: 'आपका पूरा नाम क्या है?',
      mr: 'तुमचे पूर्ण नाव काय आहे?',
    },
  },
  {
    id: 'tenantAddress',
    type: 'address',
    label: { en: 'Address of the rented place', hi: 'किराए के घर का पता', mr: 'भाड्याच्या घराचा पत्ता' },
    question: {
      en: 'What is the full address of the house or PG you rented?',
      hi: 'जिस घर या पीजी में आप किराए पर रहते थे, उसका पूरा पता बताइए।',
      mr: 'तुम्ही भाड्याने राहत होता त्या घराचा किंवा पीजीचा पूर्ण पत्ता सांगा.',
    },
  },
  {
    id: 'landlordName',
    type: 'name',
    label: { en: 'Landlord / owner name', hi: 'मकान मालिक का नाम', mr: 'घरमालकाचे नाव' },
    question: {
      en: 'What is the full name of your landlord or PG owner?',
      hi: 'आपके मकान मालिक या पीजी मालिक का पूरा नाम क्या है?',
      mr: 'तुमच्या घरमालकाचे किंवा पीजी मालकाचे पूर्ण नाव काय आहे?',
    },
  },
  {
    id: 'landlordAddress',
    type: 'address',
    label: { en: 'Landlord address', hi: 'मकान मालिक का पता', mr: 'घरमालकाचा पत्ता' },
    question: {
      en: 'What is your landlord’s address? If it is the same building, say “same”.',
      hi: 'मकान मालिक का पता क्या है? अगर वही इमारत है तो “वही” बोलिए।',
      mr: 'घरमालकाचा पत्ता काय आहे? तीच इमारत असेल तर “तोच” म्हणा.',
    },
  },
  {
    id: 'depositAmount',
    type: 'amount',
    label: { en: 'Deposit amount', hi: 'जमा राशि (डिपॉज़िट)', mr: 'अनामत रक्कम' },
    question: {
      en: 'How much security deposit did you pay, in rupees?',
      hi: 'आपने कितने रुपये सिक्योरिटी डिपॉज़िट दिया था?',
      mr: 'तुम्ही किती रुपये अनामत रक्कम दिली होती?',
    },
  },
  {
    id: 'movedOutDate',
    type: 'date',
    label: { en: 'Date you moved out', hi: 'घर छोड़ने की तारीख', mr: 'घर सोडल्याची तारीख' },
    question: {
      en: 'On what date did you move out?',
      hi: 'आपने किस तारीख को घर छोड़ा?',
      mr: 'तुम्ही कोणत्या तारखेला घर सोडले?',
    },
  },
  {
    id: 'dueDate',
    type: 'pending',
    label: { en: 'Deposit due since', hi: 'डिपॉज़िट कब से बाकी है', mr: 'रक्कम कधीपासून बाकी आहे' },
    question: {
      en: 'When was the deposit supposed to be returned? Or, for how long has it been pending?',
      hi: 'डिपॉज़िट कब तक लौटाना था? या कितने समय से बाकी है?',
      mr: 'अनामत रक्कम कधीपर्यंत परत मिळायला हवी होती? किंवा किती दिवसांपासून बाकी आहे?',
    },
  },
];

export const FIELD_IDS = FIELDS.map((f) => f.id);
export const getField = (id) => FIELDS.find((f) => f.id === id) ?? null;

// Words meaning "same as my address" for the landlord-address question.
export const SAME_ADDRESS_WORDS = ['same', 'same address', 'wahi', 'vahi', 'वही', 'वही पता', 'तोच', 'तेच', 'सेम'];
