export const translations: Record<string, Record<string, string>> = {
  en: {
    // Landing Hero
    "hero.title": "CivicLens Prototype",
    "hero.subtitle": "Report a local civic issue, get a draft AI summary, compare nearby reports, and track prototype review steps.",
    "hero.reportButton": "Save a New Report",
    "hero.viewIssues": "View Prototype Records",
    
    // Demo Banner
    "banner.demoTitle": "Interactive Demo Environment",
    "banner.demoSubtitle": "Using synthetic sample data seeded for Bengaluru municipal wards.",
    "banner.clearDemo": "Clear Demo Records",
    "banner.seedDemo": "Seed Demo Wards",

    // Report Flow Labels & Buttons
    "report.title": "Save a Civic Report",
    "report.imageLabel": "Snap / Upload Issue Photo",
    "report.imageHint": "High-contrast, clear photo of the damage/hazard.",
    "report.descLabel": "Citizen Additional Context",
    "report.descPlaceholder": "Describe the issue, specific location landmarks, or details...",
    "report.voiceInput": "Voice Input",
    "report.voiceHint": "Tap and describe the issue in Hindi or English",
    "report.detectLocation": "Detect Location",
    "report.submitting": "Saving & Analyzing...",
    "report.submit": "Save Incident Report",
    "report.cancel": "Cancel",
    "report.locationFound": "Location detected successfully",

    // Duplicate Check Screen
    "dup.title": "Checking Nearby Reports",
    "dup.matching": "Comparing this report against nearby prototype records...",
    "dup.cancel": "Cancel & edit report",
    "dup.merge": "Merge with existing",
    "dup.standalone": "Save as standalone report",

    // Issue Card Labels
    "card.category": "Category",
    "card.status": "Status",
    "card.support": "Support",
    "card.details": "Details",
    "card.upvoted": "Supported",
    "card.severity": "Severity",
    "card.urgency": "Urgency",
    "card.posted": "Posted",

    // Issue Detail Section Headers
    "detail.back": "Back to List",
    "detail.title": "Incident Dossier",
    "detail.status": "Administrative Status",
    "detail.authority": "Suggested Public Authority",
    "detail.contact": "Draft Grievance Channel",
    "detail.sla": "Estimated Follow-up Window",
    "detail.hazard": "Identified Hazards",
    "detail.privacy": "Privacy Redactions",
    "detail.timeline": "Incident Timeline & Actions",
    "detail.plan": "Draft Resolution Plan",
    "detail.verification": "Citizen Verification Panel",
    "detail.escalation": "Escalation & RTI Drafts",
    "detail.noPlan": "No resolution plan generated yet.",

    // Toast Messages
    "toast.submitted": "Report saved successfully!",
    "toast.upvote": "Support added successfully!",
    "toast.planGenerated": "Draft resolution plan generated!",
    "toast.escalationDrafted": "Escalation letter & RTI petition drafted!",
    "toast.closureVerified": "Closure review saved!",
  },
  hi: {
    // Landing Hero
    "hero.title": "CivicLens प्रोटोटाइप",
    "hero.subtitle": "स्थानीय नागरिक समस्या सेव करें, AI ड्राफ्ट सारांश देखें, पास की रिपोर्टों से तुलना करें, और प्रोटोटाइप समीक्षा चरण ट्रैक करें।",
    "hero.reportButton": "नई रिपोर्ट सेव करें",
    "hero.viewIssues": "प्रोटोटाइप रिकॉर्ड देखें",
    
    // Demo Banner
    "banner.demoTitle": "इंटरएक्टिव डेमो पर्यावरण",
    "banner.demoSubtitle": "बेंगलुरु नगर निगम वार्डों के लिए सिंथेटिक सैंपल डेटा का उपयोग।",
    "banner.clearDemo": "डेमो रिकॉर्ड साफ करें",
    "banner.seedDemo": "डेमो वार्डों को सीड करें",

    // Report Flow Labels & Buttons
    "report.title": "नागरिक रिपोर्ट सेव करें",
    "report.imageLabel": "समस्या की तस्वीर लें / अपलोड करें",
    "report.imageHint": "नुकसान/खतरे की उच्च-विपरीत, स्पष्ट तस्वीर।",
    "report.descLabel": "नागरिक अतिरिक्त संदर्भ",
    "report.descPlaceholder": "समस्या, विशिष्ट स्थान के स्थलों या विवरण का वर्णन करें...",
    "report.voiceInput": "आवाज इनपुट",
    "report.voiceHint": "टैप करें और हिंदी या अंग्रेजी में समस्या का वर्णन करें",
    "report.detectLocation": "स्थान का पता लगाएं",
    "report.submitting": "सेव और विश्लेषण किया जा रहा है...",
    "report.submit": "घटना रिपोर्ट सेव करें",
    "report.cancel": "रद्द करें",
    "report.locationFound": "स्थान का सफलतापूर्वक पता चल गया",

    // Duplicate Check Screen
    "dup.title": "पास की रिपोर्टें जांचना",
    "dup.matching": "इस रिपोर्ट की पास के प्रोटोटाइप रिकॉर्ड से तुलना की जा रही है...",
    "dup.cancel": "रद्द करें और रिपोर्ट संपादित करें",
    "dup.merge": "मौजूदा के साथ मर्ज करें",
    "dup.standalone": "स्वतंत्र रिपोर्ट के रूप में सहेजें",

    // Issue Card Labels
    "card.category": "श्रेणी",
    "card.status": "स्थिति",
    "card.support": "समर्थन करें",
    "card.details": "विवरण",
    "card.upvoted": "समर्थित",
    "card.severity": "गंभीरता",
    "card.urgency": "अति-आवश्यकता",
    "card.posted": "पोस्ट किया गया",

    // Issue Detail Section Headers
    "detail.back": "सूची पर वापस जाएं",
    "detail.title": "घटना का विवरण",
    "detail.status": "प्रशासनिक स्थिति",
    "detail.authority": "सुझाया गया सार्वजनिक प्राधिकरण",
    "detail.contact": "ड्राफ्ट शिकायत चैनल",
    "detail.sla": "अनुमानित फॉलो-अप समय",
    "detail.hazard": "पहचाने गए खतरे",
    "detail.privacy": "गोपनीयता सुधार",
    "detail.timeline": "घटना की समयरेखा और कार्रवाई",
    "detail.plan": "ड्राफ्ट समाधान योजना",
    "detail.verification": "नागरिक सत्यापन पैनल",
    "detail.escalation": "शिकायत और RTI ड्राफ्ट",
    "detail.noPlan": "अभी तक कोई समाधान योजना नहीं बनाई गई है।",

    // Toast Messages
    "toast.submitted": "रिपोर्ट सफलतापूर्वक सेव की गई!",
    "toast.upvote": "समर्थन सफलतापूर्वक जोड़ा गया!",
    "toast.planGenerated": "ड्राफ्ट समाधान योजना बनाई गई!",
    "toast.escalationDrafted": "शिकायत पत्र और आरटीआई याचिका तैयार की गई!",
    "toast.closureVerified": "समापन समीक्षा सेव की गई!",
  }
};
