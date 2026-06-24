export const translations: Record<string, Record<string, string>> = {
  en: {
    // Landing Hero
    "hero.title": "Civic Dossier & Inspectorate",
    "hero.subtitle": "Verifiable, secure public grievance tracking. Snap a photo of a civic issue, let AI analyze it, and track it to a verified resolution.",
    "hero.reportButton": "File a New Report",
    "hero.viewIssues": "View Active Records",
    
    // Demo Banner
    "banner.demoTitle": "Interactive Demo Environment",
    "banner.demoSubtitle": "Using realistic mock data seeded for Bengaluru municipal wards.",
    "banner.clearDemo": "Clear Demo Records",
    "banner.seedDemo": "Seed Demo Wards",

    // Report Flow Labels & Buttons
    "report.title": "Submit a Verifiable Civic Report",
    "report.imageLabel": "Snap / Upload Issue Photo",
    "report.imageHint": "High-contrast, clear photo of the damage/hazard.",
    "report.descLabel": "Citizen Additional Context",
    "report.descPlaceholder": "Describe the issue, specific location landmarks, or details...",
    "report.voiceInput": "Voice Input",
    "report.voiceHint": "Tap and describe the issue in Hindi or English",
    "report.detectLocation": "Detect Location",
    "report.submitting": "Uploading & Analyzing...",
    "report.submit": "Submit Incident Report",
    "report.cancel": "Cancel",
    "report.locationFound": "Location detected successfully",

    // Duplicate Check Screen
    "dup.title": "Verifying Incident Uniqueness",
    "dup.matching": "Comparing report against nearby records to prevent duplicate dispatch...",
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
    "detail.authority": "Responsible Public Authority",
    "detail.contact": "Grievance Channel",
    "detail.sla": "Official Resolution SLA",
    "detail.hazard": "Identified Hazards",
    "detail.privacy": "Privacy Redactions",
    "detail.timeline": "Incident Timeline & Actions",
    "detail.plan": "Resolution Plan & compliance packet",
    "detail.verification": "Citizen Verification Panel",
    "detail.escalation": "Escalation & RTI Filing",
    "detail.noPlan": "No resolution plan generated yet.",

    // Toast Messages
    "toast.submitted": "Report submitted successfully!",
    "toast.upvote": "Support added successfully!",
    "toast.planGenerated": "Resolution plan generated successfully!",
    "toast.escalationDrafted": "Escalation letter & RTI petition drafted!",
    "toast.closureVerified": "Closure successfully verified!",
  },
  hi: {
    // Landing Hero
    "hero.title": "नागरिक दस्तावेज़ और निरीक्षणालय",
    "hero.subtitle": "सत्यापन योग्य, सुरक्षित सार्वजनिक शिकायत ट्रैकिंग। नागरिक समस्या की एक तस्वीर लें, एआई को इसका विश्लेषण करने दें, और सत्यापित समाधान तक इसे ट्रैक करें।",
    "hero.reportButton": "नई रिपोर्ट दर्ज करें",
    "hero.viewIssues": "सक्रिय रिकॉर्ड देखें",
    
    // Demo Banner
    "banner.demoTitle": "इंटरएक्टिव डेमो पर्यावरण",
    "banner.demoSubtitle": "बेंगलुरु नगर निगम वार्डों के लिए यथार्थवादी मॉक डेटा का उपयोग करना।",
    "banner.clearDemo": "डेमो रिकॉर्ड साफ करें",
    "banner.seedDemo": "डेमो वार्डों को सीड करें",

    // Report Flow Labels & Buttons
    "report.title": "सत्यापन योग्य नागरिक रिपोर्ट सबमिट करें",
    "report.imageLabel": "समस्या की तस्वीर लें / अपलोड करें",
    "report.imageHint": "नुकसान/खतरे की उच्च-विपरीत, स्पष्ट तस्वीर।",
    "report.descLabel": "नागरिक अतिरिक्त संदर्भ",
    "report.descPlaceholder": "समस्या, विशिष्ट स्थान के स्थलों या विवरण का वर्णन करें...",
    "report.voiceInput": "आवाज इनपुट",
    "report.voiceHint": "टैप करें और हिंदी या अंग्रेजी में समस्या का वर्णन करें",
    "report.detectLocation": "स्थान का पता लगाएं",
    "report.submitting": "अपलोड और विश्लेषण किया जा रहा है...",
    "report.submit": "घटना रिपोर्ट सबमिट करें",
    "report.cancel": "रद्द करें",
    "report.locationFound": "स्थान का सफलतापूर्वक पता चल गया",

    // Duplicate Check Screen
    "dup.title": "घटना की विशिष्टता की पुष्टि करना",
    "dup.matching": "डुप्लिकेट प्रेषण को रोकने के लिए नजदीकी रिकॉर्ड के साथ रिपोर्ट की तुलना करना...",
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
    "detail.authority": "जिम्मेदार सार्वजनिक प्राधिकरण",
    "detail.contact": "शिकायत निवारण चैनल",
    "detail.sla": "आधिकारिक समाधान SLA",
    "detail.hazard": "पहचाने गए खतरे",
    "detail.privacy": "गोपनीयता सुधार",
    "detail.timeline": "घटना की समयरेखा और कार्रवाई",
    "detail.plan": "समाधान योजना और अनुपालन पैकेट",
    "detail.verification": "नागरिक सत्यापन पैनल",
    "detail.escalation": "शिकायत बढ़ाना और आरटीआई फाइलिंग",
    "detail.noPlan": "अभी तक कोई समाधान योजना नहीं बनाई गई है।",

    // Toast Messages
    "toast.submitted": "रिपोर्ट सफलतापूर्वक सबमिट की गई!",
    "toast.upvote": "समर्थन सफलतापूर्वक जोड़ा गया!",
    "toast.planGenerated": "समाधान योजना सफलतापूर्वक बनाई गई!",
    "toast.escalationDrafted": "शिकायत पत्र और आरटीआई याचिका तैयार की गई!",
    "toast.closureVerified": "समापन सफलतापूर्वक सत्यापित किया गया!",
  }
};
