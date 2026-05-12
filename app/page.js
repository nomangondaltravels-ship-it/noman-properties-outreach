'use client';

import { useEffect, useMemo, useState } from 'react';
import { canEmailContact, categoryTemplates, daysSince, normalizeCategory } from '@/lib/compliance';

const initialEmail = categoryTemplates.all.body;

const initialWhatsApp = `Dear {{name}},

You shared your details in the green list for {{serviceCategory}} in {{area}}.

Please submit your property details here:
{{formLink}}

Regards,
Xsite Real Estate`;

function escapeText(value) {
  return value || '-';
}

export default function Dashboard() {
  const [contacts, setContacts] = useState([]);
  const [responses, setResponses] = useState([]);
  const [config, setConfig] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [query, setQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('eligible');
  const [templateKey, setTemplateKey] = useState('all');
  const [subject, setSubject] = useState(categoryTemplates.all.subject);
  const [body, setBody] = useState(initialEmail);
  const [whatsAppBody, setWhatsAppBody] = useState(initialWhatsApp);
  const [message, setMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');

  async function loadData() {
    const [configRes, dataRes] = await Promise.all([fetch('/api/config'), fetch('/api/contacts')]);
    setConfig(await configRes.json());
    const data = await dataRes.json();
    setContacts(data.contacts || []);
    setResponses(data.responses || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredContacts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      const eligible = canEmailContact(contact).ok;
      if (serviceFilter !== 'all' && normalizeCategory(contact.service_category) !== serviceFilter) return false;
      if (statusFilter === 'eligible' && !eligible) return false;
      if (statusFilter === 'blocked' && eligible) return false;
      if (!normalized) return true;
      return [contact.name, contact.area, contact.email, contact.phone, contact.service_category, contact.property_type]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [contacts, query, serviceFilter, statusFilter]);

  const eligibleContacts = contacts.filter((contact) => canEmailContact(contact).ok);
  const blockedContacts = contacts.filter((contact) => !canEmailContact(contact).ok);
  const respondedContacts = contacts.filter((contact) => contact.status === 'responded');

  function applyTemplate(key) {
    const template = categoryTemplates[key] || categoryTemplates.all;
    setTemplateKey(key);
    setSubject(template.subject);
    setBody(template.body);
  }

  function formLink(contact) {
    const base = (config.publicFormBaseUrl || '').replace(/\/+$/, '');
    return `${base}/form/${contact.token}`;
  }

  function renderTemplate(value, contact) {
    return value
      .replaceAll('{{name}}', contact?.name || 'Client')
      .replaceAll('{{area}}', contact?.area || 'your selected area')
      .replaceAll('{{propertyType}}', contact?.property_type || 'property')
      .replaceAll('{{serviceCategory}}', contact?.service_category || 'property requirement')
      .replaceAll('{{formLink}}', contact ? formLink(contact) : '');
  }

  function whatsAppLink(contact) {
    const phone = String(contact?.phone || '').replace(/[^\d]/g, '');
    if (!phone) return '';
    return `https://wa.me/${phone}?text=${encodeURIComponent(renderTemplate(whatsAppBody, contact))}`;
  }

  async function importFile(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setImportMessage('Importing...');
    const response = await fetch('/api/import', { method: 'POST', body: formData });
    const data = await response.json();
    setImportMessage(response.ok ? `Added ${data.added}, updated ${data.updated}. Total contacts: ${data.total}.` : data.error);
    await loadData();
  }

  async function sendCampaign(dryRun) {
    const ids = [...selected];
    if (!ids.length) {
      setMessage('Please select contacts first.');
      return;
    }

    if (dryRun) {
      const first = contacts.find((contact) => contact.id === ids[0]);
      setMessage(renderTemplate(body, first));
      return;
    }

    setMessage('Sending emails...');
    const response = await fetch('/api/send-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, subject, body, dryRun: false })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Something went wrong.');
      return;
    }
    const sent = data.results.filter((item) => item.status === 'sent').length;
    const failed = data.results.filter((item) => item.status === 'failed').length;
    const skipped = data.results.filter((item) => item.status === 'skipped').length;
    setMessage(`Sent ${sent} email(s). Failed ${failed}. Skipped ${skipped}.`);
    await loadData();
  }

  function toggleContact(id, checked) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  function openSelectedWhatsApp() {
    const first = contacts.find((contact) => selected.has(contact.id) && contact.phone);
    if (!first) {
      setMessage('Please select a contact with phone number first.');
      return;
    }
    window.open(whatsAppLink(first), '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Internal System</p>
          <h1>Noman Properties Outreach</h1>
        </div>
        <div className="status">{config.smtpConfigured ? `SMTP ready: ${config.fromEmail}` : 'SMTP not configured'}</div>
      </header>

      <main>
        <section className="band overview">
          <Metric label="Total Contacts" value={contacts.length} />
          <Metric label="Eligible To Email" value={eligibleContacts.length} />
          <Metric label="Responded" value={respondedContacts.length} />
          <Metric label="Blocked / Waiting" value={blockedContacts.length} />
        </section>

        <section className="grid">
          <div className="panel">
            <div className="panel-head">
              <h2>Import Green List</h2>
              <span>Excel or CSV</span>
            </div>
            <form className="stack" onSubmit={importFile}>
              <input type="file" name="file" accept=".xlsx,.xls,.csv" required />
              <button type="submit">Import Contacts</button>
            </form>
            <p className="note">Supported: header sheet or Numbers export. Headerless order: Name, Service Category, Property Type, Area, Budget, Email, Phone, Subscription End Date.</p>
            {importMessage && <div className="notice">{importMessage}</div>}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Email Campaign</h2>
              <span>{selected.size} selected</span>
            </div>
            <div className="stack">
              <select value={templateKey} onChange={(event) => applyTemplate(event.target.value)}>
                {Object.entries(categoryTemplates).map(([key, template]) => (
                  <option key={key} value={key}>{template.label} Template</option>
                ))}
              </select>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} />
              <textarea rows={10} value={body} onChange={(event) => setBody(event.target.value)} />
              <div className="actions">
                <button type="button" onClick={() => sendCampaign(true)}>Preview Only</button>
                <button type="button" className="primary" onClick={() => sendCampaign(false)}>Send Email</button>
              </div>
            </div>
            <p className="note">{'Variables: {{name}}, {{area}}, {{propertyType}}, {{serviceCategory}}, {{formLink}}'}</p>
            {message && <div className="notice preserve">{message}</div>}
          </div>
        </section>

        <section className="band whats-app-band">
          <div className="table-toolbar">
            <div>
              <h2>WhatsApp Follow-up</h2>
              <p>Open a prefilled WhatsApp message for the selected client.</p>
            </div>
            <button type="button" onClick={openSelectedWhatsApp}>Open WhatsApp</button>
          </div>
          <textarea rows={5} value={whatsAppBody} onChange={(event) => setWhatsAppBody(event.target.value)} />
          <p className="note">{'Variables: {{name}}, {{area}}, {{propertyType}}, {{serviceCategory}}, {{formLink}}'}</p>
        </section>

        <section className="band table-band">
          <div className="table-toolbar">
            <div>
              <h2>Contacts</h2>
              <p>Imported green-list records and email status.</p>
            </div>
            <div className="filters">
              <input placeholder="Search name, area, email, phone" value={query} onChange={(event) => setQuery(event.target.value)} />
              <select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}>
                <option value="all">All services</option>
                <option value="sell">Sell Property</option>
                <option value="lease">Lease Property</option>
                <option value="buy">Buy / Purchase</option>
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="eligible">Eligible only</option>
                <option value="all">All contacts</option>
                <option value="blocked">Blocked / waiting</option>
              </select>
              <button type="button" onClick={() => setSelected(new Set(filteredContacts.filter((contact) => canEmailContact(contact).ok).map((contact) => contact.id)))}>Select Eligible</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Name</th>
                  <th>Service</th>
                  <th>Property</th>
                  <th>Area</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Form</th>
                  <th>WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <tr key={contact.id}>
                    <td><input type="checkbox" checked={selected.has(contact.id)} onChange={(event) => toggleContact(contact.id, event.target.checked)} /></td>
                    <td><strong>{escapeText(contact.name)}</strong></td>
                    <td>{escapeText(contact.service_category)}</td>
                    <td>{escapeText(contact.property_type)}</td>
                    <td>{escapeText(contact.area)}</td>
                    <td>{escapeText(contact.email)}</td>
                    <td>{escapeText(contact.phone)}</td>
                    <td>
                      <span className={`badge ${contact.status}`}>{contact.status || 'ready'}</span>
                      <small className="row-note">
                        {canEmailContact(contact).ok
                          ? contact.last_emailed_at ? `Last emailed ${daysSince(contact.last_emailed_at)} days ago` : 'Eligible'
                          : canEmailContact(contact).reason}
                      </small>
                    </td>
                    <td><a className="link-button" href={formLink(contact)} target="_blank">Open</a></td>
                    <td>{contact.phone ? <a className="link-button" href={whatsAppLink(contact)} target="_blank">Message</a> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid">
          <div className="panel">
            <div className="panel-head">
              <h2>Client Responses</h2>
              <span>{responses.length}</span>
            </div>
            <div className="responses">
              {!responses.length && <p className="note">No client responses yet.</p>}
              {responses.map((response) => (
                <div className="response-item" key={response.id}>
                  <strong>{response.name || 'Client'} - {response.requirement || 'Details'}</strong>
                  <p>{response.area || ''} {response.property_type || ''} {response.price ? `- ${response.price}` : ''}</p>
                  <p>{response.phone || ''} {response.email || ''}</p>
                  <p>{response.notes || ''}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>Setup Notes</h2>
              <span>Vercel + Supabase</span>
            </div>
            <ul className="notes-list">
              <li>Add Supabase and SMTP keys in Vercel Environment Variables.</li>
              <li>Set PUBLIC_FORM_BASE_URL to https://outreach.nomanproperties.com.</li>
              <li>Client form links will work publicly after domain setup.</li>
              <li>Data is saved in Supabase, not on your PC.</li>
            </ul>
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
