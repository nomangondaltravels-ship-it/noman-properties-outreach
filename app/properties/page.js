'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

function photoList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function display(value) {
  return value || '-';
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function cleanNumber(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function listingTypeLabel(value) {
  return value === 'rent' ? 'For Rent' : 'For Sale';
}

export default function PublicPropertiesPage() {
  const [listings, setListings] = useState([]);
  const [config, setConfig] = useState({});
  const [typeFilter, setTypeFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const cacheBust = Date.now();
    const [configResponse, listingResponse] = await Promise.all([
      fetch(`/api/config?t=${cacheBust}`, { cache: 'no-store' }),
      fetch(`/api/listings?available=true&t=${cacheBust}`, { cache: 'no-store' })
    ]);
    const configData = await configResponse.json();
    const listingData = await listingResponse.json();
    setConfig(configData || {});
    setListings(listingData.listings || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const areas = useMemo(() => {
    const values = listings
      .map((listing) => listing.area)
      .filter(Boolean)
      .map((area) => area.trim());
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }, [listings]);

  const filteredListings = useMemo(() => {
    const text = query.trim().toLowerCase();
    return listings.filter((listing) => {
      if (typeFilter !== 'all' && listing.listing_type !== typeFilter) return false;
      if (areaFilter !== 'all' && listing.area !== areaFilter) return false;
      if (!text) return true;
      return [
        listing.title,
        listing.property_type,
        listing.area,
        listing.building,
        listing.price,
        listing.bedrooms,
        listing.size,
        listing.notes
      ]
        .join(' ')
        .toLowerCase()
        .includes(text);
    });
  }, [areaFilter, listings, query, typeFilter]);

  const hasVisibleListings = filteredListings.length > 0;

  function inquiryText(listing) {
    return [
      `Hello ${config.brokerName || 'Hafiz Muhammad Noman'},`,
      `I am interested in this ${listingTypeLabel(listing.listing_type).toLowerCase()} listing:`,
      listing.title,
      listing.area ? `Area: ${listing.area}` : '',
      listing.price ? `Price: ${listing.price}` : '',
      'Please share more details.'
    ]
      .filter(Boolean)
      .join('\n');
  }

  function whatsAppLink(listing) {
    const number = cleanNumber(config.brokerWhatsAppNumber);
    if (!number) return '';
    return `https://wa.me/${number}?text=${encodeURIComponent(inquiryText(listing))}`;
  }

  function emailLink(listing) {
    const email = config.brokerEmail || config.fromEmail || 'noman@xsite.ae';
    const subject = `Property inquiry - ${listing.title}`;
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(inquiryText(listing))}`;
  }

  return (
    <>
      <header className="public-hero">
        <div className="public-hero-inner">
          <p className="eyebrow">Xsite Real Estate</p>
          <h1>Available Properties</h1>
          <p>
            Curated sale and rental listings shared by {config.brokerName || 'Hafiz Muhammad Noman'}.
          </p>
          <div className="public-hero-actions">
            <a className="button-link" href={`mailto:${config.brokerEmail || config.fromEmail || 'noman@xsite.ae'}`}>Email Broker</a>
            <a className="button-link subtle-link" href={config.websiteUrl || 'https://www.nomanproperties.com'} target="_blank" rel="noreferrer">Company Website</a>
          </div>
        </div>
      </header>

      <main className="public-main">
        <section className="band public-filter-band">
          <div className="segment">
            <button type="button" className={typeFilter === 'all' ? 'active' : ''} onClick={() => setTypeFilter('all')}>All</button>
            <button type="button" className={typeFilter === 'sale' ? 'active' : ''} onClick={() => setTypeFilter('sale')}>Sale</button>
            <button type="button" className={typeFilter === 'rent' ? 'active' : ''} onClick={() => setTypeFilter('rent')}>Rent</button>
          </div>
          <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
            <option value="all">All areas</option>
            {areas.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search building, area, price"
          />
          <button type="button" onClick={loadData}>Refresh</button>
        </section>

        {(loading || hasVisibleListings) && (
          <section className="public-listing-summary">
            <h2>{loading ? 'Loading listings...' : `${filteredListings.length} listing(s) available`}</h2>
            {hasVisibleListings && <p>Use the filters above to view sale or rent options.</p>}
          </section>
        )}

        <section className="public-card-grid">
          {filteredListings.map((listing) => {
            const photos = photoList(listing.photos);
            const photo = photos[0];
            const whatsapp = whatsAppLink(listing);
            return (
              <article className="public-property-card" key={listing.id}>
                {photo ? (
                  <div className="public-property-media-wrap">
                    <img className="public-property-media" src={photo} alt={listing.title} />
                    {photos.length > 1 && <span className="photo-count-badge">+{photos.length - 1} photos</span>}
                  </div>
                ) : (
                  <div className="public-property-media public-property-placeholder">
                    <span>{listingTypeLabel(listing.listing_type)}</span>
                  </div>
                )}
                <div className="public-property-body">
                  <div className="listing-card-head">
                    <span className={`listing-badge ${listing.listing_type}`}>
                      {listingTypeLabel(listing.listing_type)}
                    </span>
                    <small>{formatDate(listing.created_at)}</small>
                  </div>
                  <h2>{listing.title}</h2>
                  <p className="listing-price">{display(listing.price)}</p>
                  <div className="public-property-facts">
                    <span>{display(listing.property_type)}</span>
                    <span>{display(listing.area)}</span>
                    <span>{display(listing.bedrooms)}</span>
                    <span>{display(listing.size)}</span>
                  </div>
                  {listing.building && <p className="row-note">{listing.building}</p>}
                  {listing.notes && <p className="row-note">{listing.notes}</p>}
                  {listing.permit_number && <p className="row-note">Permit: {listing.permit_number}</p>}
                  <div className="public-property-actions">
                    <Link className="button-link" href={`/properties/${listing.id}`}>View Details</Link>
                    {whatsapp ? (
                      <a className="button-link subtle-link" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
                    ) : (
                      <a className="button-link subtle-link" href={emailLink(listing)}>Email</a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </>
  );
}
