'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const emptyListing = {
  listing_type: 'sale',
  title: '',
  property_type: 'Apartment',
  area: '',
  building: '',
  bedrooms: '',
  bathrooms: '',
  size: '',
  price: '',
  availability: 'Available',
  status: 'available',
  permit_number: '',
  photos: '',
  notes: ''
};

function firstPhoto(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .find(Boolean);
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

export default function ListingsPage() {
  const [listings, setListings] = useState([]);
  const [form, setForm] = useState(emptyListing);
  const [typeFilter, setTypeFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [shareUrl, setShareUrl] = useState('/properties');
  const [shareMessage, setShareMessage] = useState('');

  async function loadListings() {
    setLoading(true);
    const response = await fetch(`/api/listings?t=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();
    setListings(data.listings || []);
    setLoading(false);
  }

  useEffect(() => {
    loadListings();
    setShareUrl(`${window.location.origin}/properties`);
  }, []);

  const filteredListings = useMemo(() => {
    const text = query.trim().toLowerCase();
    return listings.filter((listing) => {
      if (typeFilter !== 'all' && listing.listing_type !== typeFilter) return false;
      if (!text) return true;
      return [
        listing.title,
        listing.property_type,
        listing.area,
        listing.building,
        listing.price,
        listing.availability,
        listing.permit_number,
        listing.notes
      ]
        .join(' ')
        .toLowerCase()
        .includes(text);
    });
  }, [listings, query, typeFilter]);

  const saleCount = listings.filter((listing) => listing.listing_type === 'sale').length;
  const rentCount = listings.filter((listing) => listing.listing_type === 'rent').length;
  const availableCount = listings.filter((listing) => String(listing.status || '').toLowerCase() !== 'closed').length;

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage(`Public link copied: ${shareUrl}`);
    } catch {
      setShareMessage(`Public link: ${shareUrl}`);
    }
  }

  async function saveListing(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('Saving listing...');

    const response = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || 'Unable to save listing.');
      setSaving(false);
      return;
    }

    setForm(emptyListing);
    setMessage(`Listing added: ${data.listing.title}`);
    setSaving(false);
    await loadListings();
  }

  async function removeListing(listing) {
    if (!window.confirm(`Delete ${listing.title}?`)) return;

    setDeletingId(listing.id);
    setMessage(`Deleting ${listing.title}...`);

    const response = await fetch(`/api/listings?id=${encodeURIComponent(listing.id)}&t=${Date.now()}`, {
      method: 'DELETE',
      cache: 'no-store'
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || 'Unable to delete listing.');
      setDeletingId('');
      return;
    }

    setListings((current) => current.filter((item) => item.id !== listing.id));
    setMessage(`Listing deleted: ${listing.title}`);
    setDeletingId('');
    await loadListings();
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Internal System</p>
          <h1>My Property Listings</h1>
        </div>
        <div className="top-actions">
          <Link className="button-link" href="/properties" target="_blank">View Public Page</Link>
          <button type="button" className="button-link button-reset" onClick={copyPublicLink}>Copy Share Link</button>
          <Link className="button-link" href="/">Outreach Dashboard</Link>
          <div className="status">Sale and rent inventory</div>
        </div>
      </header>

      <main>
        <section className="band overview">
          <Metric label="Total Listings" value={listings.length} />
          <Metric label="For Sale" value={saleCount} />
          <Metric label="For Rent" value={rentCount} />
          <Metric label="Available" value={availableCount} />
        </section>

        <section className="band listing-filter-band">
          <div>
            <h2>Filter Listings</h2>
            <p>Yahan sirf aapki apni saved properties show hongi. Share link: {shareUrl}</p>
            {shareMessage && <p className="share-message">{shareMessage}</p>}
          </div>
          <div className="listing-filter-controls">
            <div className="segment">
              <button type="button" className={typeFilter === 'all' ? 'active' : ''} onClick={() => setTypeFilter('all')}>All</button>
              <button type="button" className={typeFilter === 'sale' ? 'active' : ''} onClick={() => setTypeFilter('sale')}>Sale</button>
              <button type="button" className={typeFilter === 'rent' ? 'active' : ''} onClick={() => setTypeFilter('rent')}>Rent</button>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search area, building, price"
            />
            <button type="button" onClick={loadListings}>Refresh</button>
          </div>
        </section>

        <section className="listing-grid">
          <div className="panel">
            <div className="panel-head">
              <h2>Add Property</h2>
              <span>Manual listing</span>
            </div>
            <form className="listing-form-grid" onSubmit={saveListing}>
              <label>
                Listing Type
                <select value={form.listing_type} onChange={(event) => updateForm('listing_type', event.target.value)}>
                  <option value="sale">Sale</option>
                  <option value="rent">Rent</option>
                </select>
              </label>
              <label>
                Title
                <input
                  value={form.title}
                  onChange={(event) => updateForm('title', event.target.value)}
                  placeholder="Sale - 1 BHK in Business Bay"
                  required
                />
              </label>
              <label>
                Property Type
                <input
                  value={form.property_type}
                  onChange={(event) => updateForm('property_type', event.target.value)}
                  placeholder="Apartment, Villa, Plot"
                />
              </label>
              <label>
                Area
                <input
                  value={form.area}
                  onChange={(event) => updateForm('area', event.target.value)}
                  placeholder="Dubai Marina"
                />
              </label>
              <label>
                Building / Project
                <input
                  value={form.building}
                  onChange={(event) => updateForm('building', event.target.value)}
                  placeholder="Marina Gate"
                />
              </label>
              <label>
                Price
                <input
                  value={form.price}
                  onChange={(event) => updateForm('price', event.target.value)}
                  placeholder="AED 1,250,000 or AED 85,000/year"
                />
              </label>
              <label>
                Bedrooms
                <input
                  value={form.bedrooms}
                  onChange={(event) => updateForm('bedrooms', event.target.value)}
                  placeholder="1 BHK"
                />
              </label>
              <label>
                Bathrooms
                <input
                  value={form.bathrooms}
                  onChange={(event) => updateForm('bathrooms', event.target.value)}
                  placeholder="2"
                />
              </label>
              <label>
                Size
                <input
                  value={form.size}
                  onChange={(event) => updateForm('size', event.target.value)}
                  placeholder="850 sqft"
                />
              </label>
              <label>
                Availability
                <input
                  value={form.availability}
                  onChange={(event) => updateForm('availability', event.target.value)}
                  placeholder="Vacant, rented, notice served"
                />
              </label>
              <label>
                Permit Number
                <input
                  value={form.permit_number}
                  onChange={(event) => updateForm('permit_number', event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label>
                Photo URL
                <input
                  value={form.photos}
                  onChange={(event) => updateForm('photos', event.target.value)}
                  placeholder="Optional image link"
                />
              </label>
              <label className="wide">
                Notes
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => updateForm('notes', event.target.value)}
                  placeholder="View, floor, payment plan, commission, access details"
                />
              </label>
              <button type="submit" className="primary wide" disabled={saving}>
                {saving ? 'Saving...' : 'Save Listing'}
              </button>
            </form>
            {message && <div className="notice preserve">{message}</div>}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Listings</h2>
              <span>{filteredListings.length} showing</span>
            </div>
            {loading && <p className="note">Loading listings...</p>}
            {!loading && !filteredListings.length && (
              <div className="empty-state">
                <strong>No listings found.</strong>
                <p>Add a sale or rent property from the form, then use filters above.</p>
              </div>
            )}
            <div className="listing-card-grid">
              {filteredListings.map((listing) => {
                const photo = firstPhoto(listing.photos);
                return (
                  <article className="listing-card" key={listing.id}>
                    {photo ? (
                      <img className="listing-media" src={photo} alt={listing.title} />
                    ) : (
                      <div className="listing-media listing-placeholder">
                        <span>{listing.listing_type === 'rent' ? 'Rent' : 'Sale'}</span>
                      </div>
                    )}
                    <div className="listing-body">
                      <div className="listing-card-head">
                        <span className={`listing-badge ${listing.listing_type}`}>
                          {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
                        </span>
                        <small>{formatDate(listing.created_at)}</small>
                      </div>
                      <h3>{listing.title}</h3>
                      <p className="listing-price">{display(listing.price)}</p>
                      <div className="listing-detail-grid">
                        <span>{display(listing.property_type)}</span>
                        <span>{display(listing.area)}</span>
                        <span>{display(listing.bedrooms)}</span>
                        <span>{display(listing.size)}</span>
                      </div>
                      {listing.building && <p className="row-note">{listing.building}</p>}
                      {listing.notes && <p className="row-note">{listing.notes}</p>}
                      {listing.permit_number && <p className="row-note">Permit: {listing.permit_number}</p>}
                      <div className="listing-actions">
                        <span>{display(listing.availability)}</span>
                        <button
                          type="button"
                          className="danger-button"
                          disabled={deletingId === listing.id}
                          onClick={() => removeListing(listing)}
                        >
                          {deletingId === listing.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
