"use client";

import React, { useState } from "react";
import {
  Mail,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MapPin,
  Clock,
} from "lucide-react";

const WEB3FORMS_ACCESS_KEY = "35b7f2ce-025c-4af2-968d-632e16697751";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitted(false);
    setErrorMessage("");

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          from_name: "QuickConvert & SEO Tools Contact Form",
          name: name.trim(),
          email: email.trim(),
          subject:
            subject.trim() || "New Contact Form Message — QuickConvert & SEO Tools",
          message: message.trim(),
          botcheck: "",
        }),
      });

      const data = await response.json();

      if (response.ok && data?.success) {
        setSubmitted(true);
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } else {
        setErrorMessage(
          data?.message ||
            "Failed to send your message. Please try again or email us directly."
        );
      }
    } catch {
      setErrorMessage(
        "Network error while sending your message. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      <div className="max-w-4xl mx-auto w-full py-12 px-6 space-y-10">

        {/* Header */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <MessageSquare className="w-3.5 h-3.5" />
            Get in Touch
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Contact Us
          </h1>
          <p className="text-sm md:text-base text-slate-400 leading-relaxed">
            Have a question about our client-side File Converter, feedback on the AI YouTube Metadata Studio, or a business inquiry? Fill out the form below or reach out to us directly via email.
          </p>
        </div>

        {/* Contact Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Information Sidebar */}
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Mail className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-white">Email Support</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                For general inquiries, technical support, or advertising questions:
              </p>
              <a
                href="mailto:support@quickconvertseo.com"
                className="inline-block text-sm font-semibold text-indigo-400 hover:text-indigo-300 break-all"
              >
                support@quickconvertseo.com
              </a>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Clock className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-white">Response Time</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                We review all user messages daily and typically respond within 24–48 business hours.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <MapPin className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-white">Location</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                QuickConvert &amp; SEO Tools Digital Studio
                <br />
                Remote-First Global Web Platform
              </p>
            </div>
          </div>

          {/* Contact Form UI */}
          <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-white mb-2">Send Us a Message</h2>
            <p className="text-xs text-slate-400 mb-6">
              Please fill in the fields below and our team will get back to you promptly.
            </p>

            {submitted && (
              <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3 text-emerald-300 text-xs md:text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Message sent successfully! We will reply soon.
                  </p>
                  <p className="text-emerald-300/80 mt-0.5">
                    Thank you for contacting QuickConvert &amp; SEO Tools. We have
                    received your message in our inbox.
                  </p>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="mb-6 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3 text-rose-300 text-xs md:text-sm">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Could not send message</p>
                  <p className="text-rose-300/85 mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Your Name *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Email Address *
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="contact-subject"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Subject
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Feature Request / Bug Report / General Question"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-message"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Message *
                </label>
                <textarea
                  id="contact-message"
                  rows={5}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help you today?"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 transition inline-flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
