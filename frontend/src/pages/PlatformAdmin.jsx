import { useEffect, useState } from "react";
import api from "../services/api";

const emptyOrg = { name: "", max_users: 5, max_smtp_accounts: 2, max_recipients: 10000, daily_email_limit: 1000, monthly_email_limit: 30000, max_campaigns_per_day: 10 };

export default function PlatformAdmin() {
  const [organizations, setOrganizations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState(emptyOrg);
  const [editing, setEditing] = useState(null);
  const [adminOrg, setAdminOrg] = useState(null);
  const [admin, setAdmin] = useState({ name: "", email: "", username: "", password: "" });
  const [message, setMessage] = useState("");

  const load = () => Promise.all([api.get("/organizations/"), api.get("/sessions/")]).then(([orgs, active]) => {
    setOrganizations(orgs.data.results || orgs.data);
    setSessions(active.data.results || active.data);
  });
  useEffect(() => { load().catch((e) => setMessage(e.response?.data?.detail || "Unable to load platform data.")); }, []);

  const saveOrganization = async (event) => {
    event.preventDefault();
    if (editing) await api.patch(`/organizations/${editing}/`, form);
    else await api.post("/organizations/", form);
    setForm(emptyOrg); setEditing(null); setMessage("Organization saved."); await load();
  };
  const edit = (org) => { setEditing(org.id); setForm(Object.fromEntries(Object.keys(emptyOrg).map((key) => [key, org[key]]))); };
  const toggleStatus = async (org) => { await api.post(`/organizations/${org.id}/${org.status === "active" ? "suspend" : "reactivate"}/`); await load(); };
  const createAdmin = async (event) => { event.preventDefault(); await api.post(`/organizations/${adminOrg}/create-admin/`, admin); setAdminOrg(null); setAdmin({ name: "", email: "", username: "", password: "" }); setMessage("Organization admin created."); await load(); };
  const revoke = async (id) => { await api.post(`/sessions/${id}/revoke/`); await load(); };

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-slate-100">Platform administration</h1><p className="text-sm text-slate-400">Manual subscriptions, tenant usage, and active sessions.</p></div>
    {message && <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm">{message}</div>}
    <form onSubmit={saveOrganization} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl grid md:grid-cols-3 gap-3">
      <h2 className="md:col-span-3 font-semibold text-slate-100">{editing ? "Edit organization limits" : "Create organization"}</h2>
      {Object.keys(emptyOrg).map((key) => <label key={key} className="text-xs text-slate-400">{key.replaceAll("_", " ")}<input className="mt-1 w-full" required value={form[key]} type={key === "name" ? "text" : "number"} min={key === "name" ? undefined : 0} onChange={(e) => setForm({ ...form, [key]: key === "name" ? e.target.value : Number(e.target.value) })} /></label>)}
      <div className="md:col-span-3 flex gap-2"><button className="px-4 py-2 bg-indigo-600 rounded-xl text-white" type="submit">Save</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyOrg); }} className="px-4 py-2 bg-slate-700 rounded-xl">Cancel</button>}</div>
    </form>
    <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl"><table><thead><tr><th>Organization</th><th>Status</th><th>Users</th><th>SMTP</th><th>Recipients</th><th>Daily quota</th><th>Monthly quota</th><th>Actions</th></tr></thead><tbody>{organizations.map((org) => <tr key={org.id}><td>{org.name}</td><td>{org.status}</td><td>{org.user_count}/{org.max_users}</td><td>{org.smtp_count}/{org.max_smtp_accounts}</td><td>{org.recipient_count}/{org.max_recipients}</td><td>{org.usage?.daily_sent || 0}/{org.daily_email_limit}</td><td>{org.usage?.monthly_sent || 0}/{org.monthly_email_limit}</td><td className="space-x-2"><button onClick={() => edit(org)} className="text-indigo-400">Edit</button><button onClick={() => toggleStatus(org)} className="text-amber-400">{org.status === "active" ? "Suspend" : "Activate"}</button><button onClick={() => setAdminOrg(org.id)} className="text-emerald-400">Add admin</button></td></tr>)}</tbody></table></div>
    {adminOrg && <form onSubmit={createAdmin} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl grid md:grid-cols-4 gap-3"><h2 className="md:col-span-4 font-semibold">Create first organization admin</h2>{Object.keys(admin).map((key) => <input key={key} required type={key === "password" ? "password" : key === "email" ? "email" : "text"} placeholder={key} value={admin[key]} onChange={(e) => setAdmin({ ...admin, [key]: e.target.value })} />)}<button className="bg-indigo-600 rounded-xl py-2">Create admin</button><button type="button" onClick={() => setAdminOrg(null)}>Cancel</button></form>}
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto"><div className="p-5"><h2 className="font-semibold">User session activity</h2></div><table><thead><tr><th>User</th><th>IP</th><th>Created</th><th>Last seen</th><th>Status</th><th></th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td>{session.username}</td><td>{session.ip_address || "-"}</td><td>{new Date(session.created_at).toLocaleString()}</td><td>{new Date(session.last_seen_at).toLocaleString()}</td><td>{session.revoked_at ? "Revoked" : "Active"}</td><td>{!session.revoked_at && <button className="text-rose-400" onClick={() => revoke(session.id)}>Force logout</button>}</td></tr>)}</tbody></table></div>
  </div>;
}
