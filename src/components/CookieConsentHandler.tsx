'use client';

import React from 'react';
import CookieConsent from "react-cookie-consent";
import Link from 'next/link';

const updateGoogleConsent = (granted: boolean) => {
  if (typeof window.gtag === 'function') {
    const consentState = {
      'ad_storage': granted ? 'granted' : 'denied',
      'ad_user_data': granted ? 'granted' : 'denied',
      'ad_personalization': granted ? 'granted' : 'denied',
      'analytics_storage': granted ? 'granted' : 'denied'
    };
    window.gtag('consent', 'update', consentState);
    //console.log('Google Consent updated:', consentState); 
  }
};

const CookieConsentHandler: React.FC = () => {
  return (
    <CookieConsent
      location="bottom" // Pozicija banera (bottom, top, none)
      buttonText="Prihvatam"
      declineButtonText="Odbijam"
      cookieName="FrizNaKlikCookieConsent"
      expires={180}
      enableDeclineButton
      flipButtons
      // debug={process.env.NODE_ENV === 'development'} // Prikaži baner uvek u dev modu za testiranje

      containerClasses="!bg-base-300 !text-neutral-content !p-5 !shadow-lg !border-t !border-neutral-focus text-center"
      contentClasses="!text-sm !md:text-base !mb-3 !md:mb-0" 

      buttonClasses="!btn !btn-success !btn-sm !md:btn-md !font-bold" 
      declineButtonClasses="!btn !btn-error !btn-sm !md:btn-md !font-bold !mr-3" 
      style={{ zIndex: 10000 }}

      onAccept={() => {
        updateGoogleConsent(true);
      }}
      onDecline={() => {
        updateGoogleConsent(false);
      }}
    >
      Ova veb lokacija koristi kolačiće za analitiku i poboljšanje korisničkog iskustva. Vaša privatnost nam je važna.{" "}
      <Link
        href="/politika-privatnosti" 
        className="link link-hover font-bold text-accent"
      >
        Saznajte više
      </Link>
      .
    </CookieConsent>
  );
};

export default CookieConsentHandler;
