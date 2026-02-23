"use client";

import { useState } from "react";
import Link from "next/link";

type SchemaType = "faq" | "howto" | "article" | "product" | "localbusiness" | "breadcrumb" | "financialproduct" | "bank" | "definedterm";

interface FAQItem {
  question: string;
  answer: string;
}

interface HowToStep {
  name: string;
  text: string;
}

export default function SchemaGeneratorPage() {
  const [schemaType, setSchemaType] = useState<SchemaType>("faq");
  const [generatedSchema, setGeneratedSchema] = useState("");
  const [copied, setCopied] = useState(false);

  // FAQ State
  const [faqItems, setFaqItems] = useState<FAQItem[]>([
    { question: "", answer: "" },
  ]);

  // HowTo State
  const [howToTitle, setHowToTitle] = useState("");
  const [howToDescription, setHowToDescription] = useState("");
  const [howToSteps, setHowToSteps] = useState<HowToStep[]>([
    { name: "", text: "" },
  ]);

  // Article State
  const [articleTitle, setArticleTitle] = useState("");
  const [articleDescription, setArticleDescription] = useState("");
  const [articleAuthor, setArticleAuthor] = useState("");
  const [articlePublishDate, setArticlePublishDate] = useState("");
  const [articleImage, setArticleImage] = useState("");

  // Product State
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCurrency, setProductCurrency] = useState("CHF");
  const [productAvailability, setProductAvailability] = useState("InStock");
  const [productImage, setProductImage] = useState("");

  // LocalBusiness State
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("LocalBusiness");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [businessPostal, setBusinessPostal] = useState("");
  const [businessCountry, setBusinessCountry] = useState("DE");
  const [businessPhone, setBusinessPhone] = useState("");

  // Breadcrumb State
  const [breadcrumbs, setBreadcrumbs] = useState([
    { name: "Startseite", url: "https://www.beispiel.ch" },
    { name: "", url: "" },
  ]);

  // FinancialProduct State
  const [finProductName, setFinProductName] = useState("");
  const [finProductDescription, setFinProductDescription] = useState("");
  const [finProductType, setFinProductType] = useState("FinancialProduct");
  const [finProductProvider, setFinProductProvider] = useState("");
  const [finProductInterestRate, setFinProductInterestRate] = useState("");
  const [finProductAnnualRate, setFinProductAnnualRate] = useState("");
  const [finProductUrl, setFinProductUrl] = useState("");

  // BankOrCreditUnion State
  const [bankName, setBankName] = useState("");
  const [bankDescription, setBankDescription] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  const [bankCity, setBankCity] = useState("");
  const [bankPostal, setBankPostal] = useState("");
  const [bankCountry, setBankCountry] = useState("DE");
  const [bankPhone, setBankPhone] = useState("");
  const [bankUrl, setBankUrl] = useState("");
  const [bankOpeningHours, setBankOpeningHours] = useState("");

  // DefinedTerm State
  const [termName, setTermName] = useState("");
  const [termDescription, setTermDescription] = useState("");
  const [termCode, setTermCode] = useState("");
  const [termSetName, setTermSetName] = useState("");
  const [termSetUrl, setTermSetUrl] = useState("");

  const schemaTypes: { value: SchemaType; label: string; description: string }[] = [
    { value: "faq", label: "FAQ", description: "Häufig gestellte Fragen" },
    { value: "howto", label: "HowTo", description: "Schritt-für-Schritt Anleitungen" },
    { value: "article", label: "Article", description: "Blog-Artikel & News" },
    { value: "product", label: "Product", description: "Produkte & Angebote" },
    { value: "localbusiness", label: "LocalBusiness", description: "Lokale Unternehmen" },
    { value: "breadcrumb", label: "Breadcrumb", description: "Navigations-Pfade" },
    { value: "financialproduct", label: "FinancialProduct", description: "Finanzprodukte & Services" },
    { value: "bank", label: "Bank", description: "Banken & Kreditinstitute" },
    { value: "definedterm", label: "DefinedTerm", description: "Glossar & Definitionen" },
  ];

  const generateSchema = () => {
    let schema: object = {};

    switch (schemaType) {
      case "faq":
        schema = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqItems
            .filter(item => item.question && item.answer)
            .map(item => ({
              "@type": "Question",
              "name": item.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": item.answer
              }
            }))
        };
        break;

      case "howto":
        schema = {
          "@context": "https://schema.org",
          "@type": "HowTo",
          "name": howToTitle,
          "description": howToDescription,
          "step": howToSteps
            .filter(step => step.name && step.text)
            .map((step, index) => ({
              "@type": "HowToStep",
              "position": index + 1,
              "name": step.name,
              "text": step.text
            }))
        };
        break;

      case "article":
        schema = {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": articleTitle,
          "description": articleDescription,
          "author": {
            "@type": "Person",
            "name": articleAuthor
          },
          "datePublished": articlePublishDate,
          ...(articleImage && { "image": articleImage })
        };
        break;

      case "product":
        schema = {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": productName,
          "description": productDescription,
          ...(productImage && { "image": productImage }),
          "offers": {
            "@type": "Offer",
            "price": productPrice,
            "priceCurrency": productCurrency,
            "availability": `https://schema.org/${productAvailability}`
          }
        };
        break;

      case "localbusiness":
        schema = {
          "@context": "https://schema.org",
          "@type": businessType,
          "name": businessName,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": businessAddress,
            "addressLocality": businessCity,
            "postalCode": businessPostal,
            "addressCountry": businessCountry
          },
          ...(businessPhone && { "telephone": businessPhone })
        };
        break;

      case "breadcrumb":
        schema = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": breadcrumbs
            .filter(item => item.name && item.url)
            .map((item, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "name": item.name,
              "item": item.url
            }))
        };
        break;

      case "financialproduct":
        schema = {
          "@context": "https://schema.org",
          "@type": finProductType,
          "name": finProductName,
          "description": finProductDescription,
          ...(finProductProvider && {
            "provider": {
              "@type": "Organization",
              "name": finProductProvider
            }
          }),
          ...(finProductInterestRate && { "interestRate": parseFloat(finProductInterestRate) }),
          ...(finProductAnnualRate && { "annualPercentageRate": parseFloat(finProductAnnualRate) }),
          ...(finProductUrl && { "url": finProductUrl })
        };
        break;

      case "bank":
        schema = {
          "@context": "https://schema.org",
          "@type": "BankOrCreditUnion",
          "name": bankName,
          ...(bankDescription && { "description": bankDescription }),
          "address": {
            "@type": "PostalAddress",
            "streetAddress": bankAddress,
            "addressLocality": bankCity,
            "postalCode": bankPostal,
            "addressCountry": bankCountry
          },
          ...(bankPhone && { "telephone": bankPhone }),
          ...(bankUrl && { "url": bankUrl }),
          ...(bankOpeningHours && { "openingHours": bankOpeningHours })
        };
        break;

      case "definedterm":
        schema = {
          "@context": "https://schema.org",
          "@type": "DefinedTerm",
          "name": termName,
          "description": termDescription,
          ...(termCode && { "termCode": termCode }),
          ...(termSetUrl ? {
            "inDefinedTermSet": {
              "@type": "DefinedTermSet",
              "name": termSetName || undefined,
              "url": termSetUrl
            }
          } : termSetName ? { "inDefinedTermSet": termSetName } : {})
        };
        break;
    }

    setGeneratedSchema(JSON.stringify(schema, null, 2));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addFaqItem = () => {
    setFaqItems([...faqItems, { question: "", answer: "" }]);
  };

  const removeFaqItem = (index: number) => {
    setFaqItems(faqItems.filter((_, i) => i !== index));
  };

  const addHowToStep = () => {
    setHowToSteps([...howToSteps, { name: "", text: "" }]);
  };

  const removeHowToStep = (index: number) => {
    setHowToSteps(howToSteps.filter((_, i) => i !== index));
  };

  const addBreadcrumb = () => {
    setBreadcrumbs([...breadcrumbs, { name: "", url: "" }]);
  };

  const removeBreadcrumb = (index: number) => {
    setBreadcrumbs(breadcrumbs.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/seo-helper"
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="p-3 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-500/25">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Schema Generator</h1>
          <p className="text-slate-500 dark:text-slate-400">Strukturierte Daten für Rich Snippets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-6">
          {/* Schema Type Selector */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Schema-Typ wählen</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {schemaTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSchemaType(type.value)}
                  className={`p-3 rounded-xl text-left transition-all ${
                    schemaType === type.value
                      ? "bg-pink-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  <div className="font-medium text-sm">{type.label}</div>
                  <div className={`text-xs ${schemaType === type.value ? "text-pink-200" : "text-slate-500"}`}>
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Form based on Schema Type */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">Daten eingeben</h2>

            {/* FAQ Form */}
            {schemaType === "faq" && (
              <div className="space-y-4">
                {faqItems.map((item, index) => (
                  <div key={index} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Frage {index + 1}
                      </span>
                      {faqItems.length > 1 && (
                        <button
                          onClick={() => removeFaqItem(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Entfernen
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Frage eingeben..."
                      value={item.question}
                      onChange={(e) => {
                        const newItems = [...faqItems];
                        newItems[index].question = e.target.value;
                        setFaqItems(newItems);
                      }}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <textarea
                      placeholder="Antwort eingeben..."
                      value={item.answer}
                      onChange={(e) => {
                        const newItems = [...faqItems];
                        newItems[index].answer = e.target.value;
                        setFaqItems(newItems);
                      }}
                      rows={2}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
                    />
                  </div>
                ))}
                <button
                  onClick={addFaqItem}
                  className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-pink-500 hover:text-pink-500 transition-colors"
                >
                  + Weitere Frage hinzufügen
                </button>
              </div>
            )}

            {/* HowTo Form */}
            {schemaType === "howto" && (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Titel der Anleitung"
                  value={howToTitle}
                  onChange={(e) => setHowToTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
                <textarea
                  placeholder="Beschreibung der Anleitung"
                  value={howToDescription}
                  onChange={(e) => setHowToDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
                />
                {howToSteps.map((step, index) => (
                  <div key={index} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Schritt {index + 1}
                      </span>
                      {howToSteps.length > 1 && (
                        <button onClick={() => removeHowToStep(index)} className="text-red-500 hover:text-red-700 text-sm">
                          Entfernen
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Schritt-Titel"
                      value={step.name}
                      onChange={(e) => {
                        const newSteps = [...howToSteps];
                        newSteps[index].name = e.target.value;
                        setHowToSteps(newSteps);
                      }}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <textarea
                      placeholder="Schritt-Beschreibung"
                      value={step.text}
                      onChange={(e) => {
                        const newSteps = [...howToSteps];
                        newSteps[index].text = e.target.value;
                        setHowToSteps(newSteps);
                      }}
                      rows={2}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
                    />
                  </div>
                ))}
                <button
                  onClick={addHowToStep}
                  className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-pink-500 hover:text-pink-500 transition-colors"
                >
                  + Weiteren Schritt hinzufügen
                </button>
              </div>
            )}

            {/* Article Form */}
            {schemaType === "article" && (
              <div className="space-y-4">
                <input type="text" placeholder="Artikel-Titel" value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <textarea placeholder="Artikel-Beschreibung" value={articleDescription} onChange={(e) => setArticleDescription(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none" />
                <input type="text" placeholder="Autor" value={articleAuthor} onChange={(e) => setArticleAuthor(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <input type="date" placeholder="Veröffentlichungsdatum" value={articlePublishDate} onChange={(e) => setArticlePublishDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <input type="text" placeholder="Bild-URL (optional)" value={articleImage} onChange={(e) => setArticleImage(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
              </div>
            )}

            {/* Product Form */}
            {schemaType === "product" && (
              <div className="space-y-4">
                <input type="text" placeholder="Produktname" value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <textarea placeholder="Produktbeschreibung" value={productDescription} onChange={(e) => setProductDescription(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Preis" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                  <select value={productCurrency} onChange={(e) => setProductCurrency(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                    <option value="CHF">CHF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <select value={productAvailability} onChange={(e) => setProductAvailability(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                  <option value="InStock">Auf Lager</option>
                  <option value="OutOfStock">Nicht verfügbar</option>
                  <option value="PreOrder">Vorbestellung</option>
                </select>
                <input type="text" placeholder="Bild-URL (optional)" value={productImage} onChange={(e) => setProductImage(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
              </div>
            )}

            {/* LocalBusiness Form */}
            {schemaType === "localbusiness" && (
              <div className="space-y-4">
                <input type="text" placeholder="Firmenname" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                  <option value="LocalBusiness">Lokales Unternehmen</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Store">Geschäft</option>
                  <option value="MedicalBusiness">Medizinisches Unternehmen</option>
                  <option value="FinancialService">Finanzdienstleister</option>
                </select>
                <input type="text" placeholder="Strasse & Hausnummer" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="PLZ" value={businessPostal} onChange={(e) => setBusinessPostal(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                  <input type="text" placeholder="Stadt" value={businessCity} onChange={(e) => setBusinessCity(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                </div>
                <input type="tel" placeholder="Telefon (optional)" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
              </div>
            )}

            {/* Breadcrumb Form */}
            {schemaType === "breadcrumb" && (
              <div className="space-y-4">
                {breadcrumbs.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 w-6">{index + 1}.</span>
                    <input
                      type="text"
                      placeholder="Name"
                      value={item.name}
                      onChange={(e) => {
                        const newItems = [...breadcrumbs];
                        newItems[index].name = e.target.value;
                        setBreadcrumbs(newItems);
                      }}
                      className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="URL"
                      value={item.url}
                      onChange={(e) => {
                        const newItems = [...breadcrumbs];
                        newItems[index].url = e.target.value;
                        setBreadcrumbs(newItems);
                      }}
                      className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    {breadcrumbs.length > 1 && (
                      <button onClick={() => removeBreadcrumb(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addBreadcrumb}
                  className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-pink-500 hover:text-pink-500 transition-colors"
                >
                  + Weitere Ebene hinzufügen
                </button>
              </div>
            )}

            {/* FinancialProduct Form */}
            {schemaType === "financialproduct" && (
              <div className="space-y-4">
                <select value={finProductType} onChange={(e) => setFinProductType(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                  <option value="FinancialProduct">Finanzprodukt (allgemein)</option>
                  <option value="LoanOrCredit">Kredit / Darlehen</option>
                  <option value="BankAccount">Bankkonto</option>
                  <option value="InvestmentOrDeposit">Investment / Anlage</option>
                  <option value="PaymentCard">Zahlungskarte</option>
                  <option value="CurrencyConversionService">Währungsumrechnung</option>
                </select>
                <input type="text" placeholder="Produktname (z.B. Festhypothek 10 Jahre)" value={finProductName} onChange={(e) => setFinProductName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <textarea placeholder="Produktbeschreibung" value={finProductDescription} onChange={(e) => setFinProductDescription(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none" />
                <input type="text" placeholder="Anbieter (z.B. TARGOBANK)" value={finProductProvider} onChange={(e) => setFinProductProvider(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Zinssatz (%)</label>
                    <input type="number" step="0.01" placeholder="z.B. 1.5" value={finProductInterestRate} onChange={(e) => setFinProductInterestRate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Effektivzins / APR (%)</label>
                    <input type="number" step="0.01" placeholder="z.B. 1.65" value={finProductAnnualRate} onChange={(e) => setFinProductAnnualRate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                  </div>
                </div>
                <input type="url" placeholder="URL zur Produktseite (optional)" value={finProductUrl} onChange={(e) => setFinProductUrl(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
              </div>
            )}

            {/* BankOrCreditUnion Form */}
            {schemaType === "bank" && (
              <div className="space-y-4">
                <input type="text" placeholder="Name der Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <textarea placeholder="Beschreibung (optional)" value={bankDescription} onChange={(e) => setBankDescription(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none" />
                <input type="text" placeholder="Strasse & Hausnummer" value={bankAddress} onChange={(e) => setBankAddress(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="PLZ" value={bankPostal} onChange={(e) => setBankPostal(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                  <input type="text" placeholder="Stadt" value={bankCity} onChange={(e) => setBankCity(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                </div>
                <select value={bankCountry} onChange={(e) => setBankCountry(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                  <option value="CH">Schweiz</option>
                  <option value="DE">Deutschland</option>
                  <option value="AT">Österreich</option>
                  <option value="LI">Liechtenstein</option>
                </select>
                <input type="tel" placeholder="Telefon (optional)" value={bankPhone} onChange={(e) => setBankPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <input type="url" placeholder="Website URL (optional)" value={bankUrl} onChange={(e) => setBankUrl(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Öffnungszeiten (optional, z.B. Mo-Fr 08:00-18:00)</label>
                  <input type="text" placeholder="Mo-Fr 08:00-18:00" value={bankOpeningHours} onChange={(e) => setBankOpeningHours(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                </div>
              </div>
            )}

            {/* DefinedTerm Form */}
            {schemaType === "definedterm" && (
              <div className="space-y-4">
                <input type="text" placeholder="Begriff (z.B. Hypothek)" value={termName} onChange={(e) => setTermName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <textarea placeholder="Definition / Beschreibung des Begriffs" value={termDescription} onChange={(e) => setTermDescription(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none" />
                <input type="text" placeholder="Term-Code (optional, z.B. HYP-001)" value={termCode} onChange={(e) => setTermCode(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Zugehöriges Glossar/Wörterbuch (optional)</span>
                  <input type="text" placeholder="Name des Glossars (z.B. Finanzlexikon)" value={termSetName} onChange={(e) => setTermSetName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                  <input type="url" placeholder="URL des Glossars" value={termSetUrl} onChange={(e) => setTermSetUrl(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                </div>
              </div>
            )}

            <button
              onClick={generateSchema}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 transition-all"
            >
              Schema generieren
            </button>
          </div>
        </div>

        {/* Output Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Generiertes Schema (JSON-LD)</h2>
            {generatedSchema && (
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Kopiert!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Kopieren
                  </>
                )}
              </button>
            )}
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 min-h-[400px]">
            {generatedSchema ? (
              <pre className="text-sm text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
                <code>{`<script type="application/ld+json">\n${generatedSchema}\n</script>`}</code>
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <p>Schema wird hier angezeigt...</p>
              </div>
            )}
          </div>

          {/* Integration Hint */}
          <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 border border-pink-200 dark:border-pink-800">
            <h3 className="font-medium text-pink-900 dark:text-pink-100 mb-2">Integration</h3>
            <p className="text-sm text-pink-800 dark:text-pink-200">
              Füge den generierten Code in den <code className="bg-pink-100 dark:bg-pink-800 px-1 rounded">&lt;head&gt;</code> Bereich deiner HTML-Seite ein. 
              Teste das Schema mit dem <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer" className="underline hover:text-pink-600">Google Rich Results Test</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
