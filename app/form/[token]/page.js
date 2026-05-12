'use client';

import { useEffect, useState } from 'react';

const emptyForm = {
  requirement: '',
  property_type: '',
  area: '',
  building: '',
  bedrooms: '',
  size: '',
  price: '',
  availability: '',
  name: '',
  phone: '',
  email: '',
  preferred_contact: 'WhatsApp',
  notes: ''
};

export default function ClientForm({ params }) {
  const [contact, setContact] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadContact() {
      const response = await fetch(`/api/form/${params.token}`);
      const data = await response.json();
      if (!response.ok) {
        setNotFound(true);
        return;
      }
      setContact(data);
      setForm((current) => ({
        ...current,
        name: data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        property_type: data.property_type || '',
        area: data.area || '',
        requirement: (data.service_category || '').toLowerCase().includes('sell') ? 'Sell Property' : ''
      }));
    }
    loadContact();
  }, [params.token]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setMessage('Submitting...');
    const response = await fetch(`/api/form/${params.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Unable to submit details.');
      return;
    }
    setMessage('Thank you. Your property details have been submitted.');
    setForm(emptyForm);
  }

  if (notFound) {
    return (
      <main className="client-form">
        <div className="brand-block">
          <p className="eyebrow">Noman Properties</p>
          <h1>Invalid Link</h1>
          <p>This form link is not valid.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="client-form">
      <div className="brand-block">
        <p className="eyebrow">Noman Properties</p>
        <h1>Property Details</h1>
        <p>{contact ? `${contact.name || 'Dear client'}, please share the basic details for ${contact.service_category || 'your property requirement'} in ${contact.area || 'your selected area'}.` : 'Loading...'}</p>
      </div>

      <form className="details-grid" onSubmit={submit}>
        <Field label="Requirement">
          <select required value={form.requirement} onChange={(event) => update('requirement', event.target.value)}>
            <option value="">Select</option>
            <option>Sell Property</option>
            <option>Buy Property</option>
            <option>Rent Property</option>
            <option>Other</option>
          </select>
        </Field>
        <TextField label="Property Type" value={form.property_type} onChange={(value) => update('property_type', value)} placeholder="Apartment, Villa, Land, Building" required />
        <TextField label="Area" value={form.area} onChange={(value) => update('area', value)} placeholder="Business Bay, JVC, Dubai Marina" required />
        <TextField label="Building / Community" value={form.building} onChange={(value) => update('building', value)} />
        <TextField label="Bedrooms" value={form.bedrooms} onChange={(value) => update('bedrooms', value)} placeholder="Studio, 1, 2, 3" />
        <TextField label="Size" value={form.size} onChange={(value) => update('size', value)} placeholder="sqft / plot size" />
        <TextField label="Expected Price / Budget" value={form.price} onChange={(value) => update('price', value)} placeholder="AED" />
        <TextField label="Availability" value={form.availability} onChange={(value) => update('availability', value)} placeholder="Vacant, rented, handover date" />
        <TextField label="Your Name" value={form.name} onChange={(value) => update('name', value)} required />
        <TextField label="Phone" value={form.phone} onChange={(value) => update('phone', value)} required />
        <TextField label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} />
        <Field label="Preferred Contact">
          <select value={form.preferred_contact} onChange={(event) => update('preferred_contact', event.target.value)}>
            <option>WhatsApp</option>
            <option>Phone Call</option>
            <option>Email</option>
          </select>
        </Field>
        <label className="wide">
          Extra Details
          <textarea rows={5} value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Add any important property details, documents available, timeline, or questions." />
        </label>
        <button className="primary wide" type="submit">Submit Details</button>
      </form>
      {message && <div className="notice">{message}</div>}
    </main>
  );
}

function Field({ label, children }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}

function TextField({ label, value, onChange, type = 'text', ...props }) {
  return (
    <label>
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}
