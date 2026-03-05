import { Call } from './types';

export const MOCK_CALLS: Call[] = [
  {
    id: "101",
    customerPhone: "+90 555 123 4567",
    status: "live",
    startTime: "14:30",
    duration: "02:15",
    summary: "Ongoing conversation about subscription renewal.",
    transcript: [
      { role: "ai", text: "Hello, calling from Vapi Solutions. How can I help you today?" },
      { role: "user", text: "Hi, I wanted to check if I can renew my subscription early." },
      { role: "ai", text: "Absolutely. I can help you with that. Are you looking to keep the same plan?" }
    ]
  },
  {
    id: "102",
    customerPhone: "+1 202 555 0199",
    status: "completed",
    startTime: "13:45",
    duration: "04:12",
    summary: "Customer scheduled a demo appointment for next Tuesday.",
    transcript: [
      { role: "ai", text: "Hello! Thank you for calling Vapi. How may I assist you?" },
      { role: "user", text: "I'd like to book a demo for your CRM integration." },
      { role: "ai", text: "Great choice. I can schedule that. Is Tuesday at 2 PM good for you?" },
      { role: "user", text: "Yes, that works perfectly." },
      { role: "ai", text: "Confirmed. You will receive an email shortly. Goodbye!" }
    ]
  },
  {
    id: "103",
    customerPhone: "+44 7700 900077",
    status: "handed-off",
    startTime: "12:15",
    duration: "01:30",
    summary: "Complex billing dispute required human intervention.",
    transcript: [
      { role: "ai", text: "Hello, Vapi Support here." },
      { role: "user", text: "I have a double charge on my invoice #99283." },
      { role: "ai", text: "I see the invoice. Let me check the transaction history." },
      { role: "user", text: "It's really frustrating, I need this resolved now." },
      { role: "ai", text: "I understand. This requires authorization I don't have. Connecting you to a billing specialist now." }
    ]
  },
  {
    id: "104",
    customerPhone: "+90 532 999 8877",
    status: "completed",
    startTime: "11:00",
    duration: "02:45",
    summary: "Customer asked about opening hours and location.",
    transcript: [
      { role: "ai", text: "Hello, how can I help?" },
      { role: "user", text: "Are you open on Sundays?" },
      { role: "ai", text: "Yes, we are open from 10 AM to 4 PM on Sundays." },
      { role: "user", text: "Great, thanks!" }
    ]
  },
  {
    id: "105",
    customerPhone: "+1 415 555 2233",
    status: "completed",
    startTime: "10:20",
    duration: "03:10",
    summary: "Inquiry about API pricing tiers.",
    transcript: [
        { role: "ai", text: "Welcome to Vapi. How can I direct your call?" },
        { role: "user", text: "How much is the enterprise plan?" },
        { role: "ai", text: "Enterprise pricing is custom based on volume. Would you like a sales rep to contact you?" }
    ]
  }
];