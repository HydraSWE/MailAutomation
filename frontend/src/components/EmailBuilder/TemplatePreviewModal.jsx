import FormModal from "../common/FormModal";

export default function TemplatePreviewModal({ html, onClose }) {
  if (html === null) return null;
  return (
    <FormModal isOpen onClose={onClose} title="Email Template Live Preview" subtitle="How your email renders in recipient inboxes." maxWidth="max-w-3xl">
      <div className="p-4 bg-white rounded-xl border border-slate-300 min-h-[350px] overflow-y-auto">
        <iframe sandbox="" srcDoc={html} title="Template Preview" className="w-full min-h-[400px] border-0" />
      </div>
    </FormModal>
  );
}
