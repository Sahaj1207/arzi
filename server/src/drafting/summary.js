// Demo-mode plain-language summary in the citizen's language, one point per line.
// Step 7 reads these points aloud one by one: who it is sent to, the amount
// claimed, the deadline, and what happens next.
import { getField, displayFieldValue, formatINR } from '@arzi/shared';
import { DAYS_TO_PAY } from './notice.js';

const show = (id, fields, lang) => displayFieldValue(getField(id), fields[id], lang);

const TEMPLATES = {
  en: (f) => [
    `This is a legal notice from you, ${f.tenant}, to your landlord ${f.landlord}, at ${f.landlordAddress}.`,
    `It says that you paid a security deposit of ${f.amount} for ${f.premises}, that you moved out on ${f.movedOut}, and that the deposit has not been returned.`,
    `It asks the landlord to return ${f.amount}. It does not ask for anything more now, but it keeps your right to ask for interest and legal costs later, if you go to court.`,
    `The landlord gets ${DAYS_TO_PAY} days from receiving the notice to pay you.`,
    `If the landlord does not pay within ${DAYS_TO_PAY} days, you can file a case to get your money back. An advocate checks this notice before it is final.`,
  ],
  hi: (f) => [
    `यह आपकी, ${f.tenant} की ओर से, आपके मकान मालिक ${f.landlord} को, पता ${f.landlordAddress} पर, भेजा जाने वाला लीगल नोटिस है।`,
    `इसमें लिखा है कि आपने ${f.premises} के लिए ${f.amount} सिक्योरिटी डिपॉज़िट दिया था, आपने ${f.movedOut} को घर छोड़ा, और डिपॉज़िट अभी तक वापस नहीं मिला।`,
    `इसमें मकान मालिक से ${f.amount} लौटाने को कहा गया है। अभी इससे ज़्यादा कुछ नहीं माँगा गया है, लेकिन अगर आप कोर्ट जाते हैं तो बाद में ब्याज और कानूनी खर्च माँगने का आपका हक़ बना रहता है।`,
    `नोटिस मिलने के बाद मकान मालिक के पास पैसे लौटाने के लिए ${DAYS_TO_PAY} दिन हैं।`,
    `अगर ${DAYS_TO_PAY} दिनों में पैसे नहीं लौटाए गए, तो आप पैसे वापस पाने के लिए केस कर सकते हैं। यह नोटिस पक्का होने से पहले एक वकील इसे जाँचते हैं।`,
  ],
  mr: (f) => [
    `ही तुमच्याकडून, ${f.tenant} यांच्याकडून, तुमचे घरमालक ${f.landlord} यांना, ${f.landlordAddress} या पत्त्यावर पाठवायची कायदेशीर नोटीस आहे.`,
    `यात लिहिले आहे की तुम्ही ${f.premises} साठी ${f.amount} अनामत रक्कम दिली होती, तुम्ही ${f.movedOut} रोजी घर सोडले, आणि ती रक्कम अजून परत मिळालेली नाही.`,
    `यात घरमालकाकडे ${f.amount} परत करण्याची मागणी केली आहे. सध्या यापेक्षा जास्त काही मागितलेले नाही, पण तुम्ही कोर्टात गेलात तर नंतर व्याज आणि कायदेशीर खर्च मागण्याचा तुमचा हक्क राखून ठेवला आहे.`,
    `नोटीस मिळाल्यापासून घरमालकाकडे पैसे परत करण्यासाठी ${DAYS_TO_PAY} दिवस आहेत.`,
    `${DAYS_TO_PAY} दिवसांत पैसे परत न केल्यास, तुम्ही पैसे परत मिळवण्यासाठी केस दाखल करू शकता. ही नोटीस अंतिम होण्यापूर्वी एक वकील ती तपासतात.`,
  ],
};

export function buildSummary(fields, lang) {
  const l = TEMPLATES[lang] ? lang : 'en';
  const f = {
    tenant: fields.tenantName.text,
    premises: fields.tenantAddress.text,
    landlord: fields.landlordName.text,
    landlordAddress: fields.landlordAddress.text,
    amount: formatINR(fields.depositAmount.amount),
    movedOut: show('movedOutDate', fields, l),
  };
  return TEMPLATES[l](f).join('\n');
}
