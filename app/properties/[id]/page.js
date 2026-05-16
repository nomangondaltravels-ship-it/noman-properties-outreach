'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

function photoList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function display(value, fallback = '-') {
  return value || fallback;
}

function cleanNumber(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function listingTypeLabel(value) {
  return value === 'rent' ? 'For Rent' : 'For Sale';
}

function inquiryText(listing, config) {
  return [
    `Hello ${config.brokerName || 'Hafiz Muhammad Noman'},`,
    `I am interested in this ${listingTypeLabel(listing.listing_type).toLowerCase()} listing:`,
    listing.title,
    listing.area ? `Area: ${listing.area}` : '',
    listing.building ? `Building: ${listing.building}` : '',
    listing.price ? `Price: ${listing.price}` : '',
    listing.size ? `Size: ${listing.size}` : '',
    'Please share full details and viewing availability.'
  ]
    .filter(Boolean)
    .join('\n');
}

function detailRows(listing) {
  return [
    ['Listing Type', listingTypeLabel(listing.listing_type)],
    ['Property Type', display(listing.property_type)],
    ['Area', display(listing.area)],
    ['Building / Project', display(listing.building)],
    ['Bedrooms', display(listing.bedrooms)],
    ['Bathrooms', display(listing.bathrooms)],
    ['Size', display(listing.size)],
    ['Availability', display(listing.availability)],
    ['Permit Number', display(listing.permit_number, 'Not provided')],
    listing.nexbridge_ref ? ['Listing Ref', listing.nexbridge_ref] : null
  ].filter(Boolean);
}

export default function PropertyDetailPage({ params }) {
  const listingId = params?.id || '';
  const [listing, setListing] = useState(null);
  const [config, setConfig] = useState({});
  const [selectedPhoto, setSelectedPhoto] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const photos = useMemo(() => photoList(listing?.photos), [listing?.photos]);

  useEffect(() => {
    async function loadListing() {
      setLoading(true);
      setError('');
      const cacheBust = Date.now();
      const [configResponse, listingResponse] = await Promise.all([
        fetch(`/api/config?t=${cacheBust}`, { cache: 'no-store' }),
        fetch(`/api/listings?id=${encodeURIComponent(listingId)}&available=true&t=${cacheBust}`, { cache: 'no-store' })
      ]);
      const configData = await configResponse.json();
      const listingData = await listingResponse.json();
      setConfig(configData || {});

      if (!listingResponse.ok) {
        setListing(null);
        setError(listingData.error || 'This property is not available.');
        setLoading(false);
        return;
      }

      setListing(listingData.listing);
      setSelectedPhoto(photoList(listingData.listing?.photos)[0] || '');
      setLoading(false);
    }

    if (listingId) {
      loadListing();
    }
  }, [listingId]);

  function whatsAppLink() {
    const number = cleanNumber(config.brokerWhatsAppNumber);
    if (!number || !listing) return '';
    return `https://wa.me/${number}?text=${encodeURIComponent(inquiryText(listing, config))}`;
  }

  function emailLink() {
    const email = config.brokerEmail || config.fromEmail || 'noman@xsite.ae';
    const subject = listing ? `Property inquiry - ${listing.title}` : 'Property inquiry';
    const body = listing ? inquiryText(listing, config) : 'Please share property details.';
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function copyCurrentLink() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage('Listing link copied.');
    } catch {
      setCopyMessage(url);
    }
  }

  if (loading) {
    return (
      <main className="property-detail-main">
        <section className="band property-loading">
          <strong>Loading property details...</strong>
        </section>
      </main>
    );
  }

  if (error || !listing) {
    return (
      <main className="property-detail-main">
        <section className="band property-loading">
          <strong>{error || 'This property is not available.'}</strong>
          <Link className="button-link" href="/properties">View Available Properties</Link>
        </section>
      </main>
    );
  }

  const whatsapp = whatsAppLink();
  const brokerPhone = cleanNumber(config.brokerWhatsAppNumber);

  return (
    <>
      <header className="public-hero property-detail-hero">
        <div className="public-hero-inner">
          <p className="eyebrow">Xsite Real Estate</p>
          <h1>{listing.title}</h1>
          <p>
            {listingTypeLabel(listing.listing_type)} in {display(listing.area, 'Dubai')}. Shared by{' '}
            {config.brokerName || 'Hafiz Muhammad Noman'}.
          </p>
          <div className="public-hero-actions">
            <Link className="button-link" href="/properties">All Listings</Link>
            <button type="button" className="button-link subtle-link" onClick={copyCurrentLink}>Copy Link</button>
          </div>
        </div>
      </header>

      <main className="property-detail-main">
        <section className="property-detail-shell">
          <div className="property-gallery">
            <div className="property-main-photo">
              {selectedPhoto ? (
                <img src={selectedPhoto} alt={listing.title} />
              ) : (
                <div className="property-photo-placeholder">
                  <span>{listingTypeLabel(listing.listing_type)}</span>
                </div>
              )}
            </div>
            {photos.length > 1 && (
              <div className="property-thumb-grid">
                {photos.map((photo, index) => (
                  <button
                    type="button"
                    className={selectedPhoto === photo ? 'active' : ''}
                    key={photo}
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <img src={photo} alt={`${listing.title} photo ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="property-info-panel">
            <span className={`listing-badge ${listing.listing_type}`}>
              {listingTypeLabel(listing.listing_type)}
            </span>
            <h2>{display(listing.price, 'Price on request')}</h2>
            <p>{display(listing.building, display(listing.area, 'Dubai'))}</p>
            <div className="property-cta-grid">
              {whatsapp && <a className="button-link" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>}
              {brokerPhone && <a className="button-link subtle-link" href={`tel:+${brokerPhone}`}>Call</a>}
              <a className="button-link subtle-link" href={emailLink()}>Email</a>
              <button type="button" className="button-link button-reset" onClick={copyCurrentLink}>Share Link</button>
              {listing.nexbridge_url && (
                <a className="button-link subtle-link" href={listing.nexbridge_url} target="_blank" rel="noreferrer">NexBridge Listing</a>
              )}
            </div>
            {copyMessage && <p className="property-copy-message">{copyMessage}</p>}
            <div className="broker-mini-card">
              <strong>{config.brokerName || 'Hafiz Muhammad Noman'}</strong>
              <span>Broker ID: {config.brokerId || '78569'}</span>
              <span>{config.brokerEmail || config.fromEmail || 'noman@xsite.ae'}</span>
              <span>{config.companyName || 'Xsite Real Estate'}</span>
            </div>
          </aside>
        </section>

        <section className="property-fact-bar">
          <span><strong>{display(listing.bedrooms)}</strong> Bedrooms</span>
          <span><strong>{display(listing.bathrooms)}</strong> Bathrooms</span>
          <span><strong>{display(listing.size)}</strong> Size</span>
          <span><strong>{display(listing.availability)}</strong> Availability</span>
        </section>

        <section className="property-detail-section">
          <h2>Property Details</h2>
          <div className="property-detail-list">
            {detailRows(listing).map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        {listing.notes && (
          <section className="property-detail-section">
            <h2>Description</h2>
            <p>{listing.notes}</p>
          </section>
        )}
      </main>
    </>
  );
}
