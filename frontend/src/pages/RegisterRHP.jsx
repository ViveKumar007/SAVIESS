import React, { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, ArrowRight, User, Briefcase, MapPin, Building2,
  Heart, Target, DollarSign, Landmark, Upload, CheckCircle,
  AlertTriangle, FileText, X, Camera, Save, RotateCcw, Send, Loader2
} from 'lucide-react';
import { API } from '../api';

// ── Validation Helpers ──
const MOBILE_RE = /^\d{10}$/;
const AADHAAR_RE = /^\d{12}$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const PIN_RE = /^\d{6}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const STEPS = [
  { key: 'basic', label: 'Basic Information', icon: User },
  { key: 'professional', label: 'Professional', icon: Briefcase },
  { key: 'location', label: 'Practice Location', icon: MapPin },
  { key: 'infrastructure', label: 'Infrastructure', icon: Building2 },
  { key: 'experience', label: 'Experience', icon: Heart },
  { key: 'interest', label: 'Interest', icon: Target },
  { key: 'financial', label: 'Financial', icon: DollarSign },
  { key: 'bank', label: 'Bank Details', icon: Landmark },
  { key: 'uploads', label: 'Uploads', icon: Upload },
];

const DRAFT_KEY = 'saviess_rhp_draft';

// ── Context to share form state with sub-components ──
const RHPFormContext = createContext(null);

// ── Reusable field components (module scope = stable identity) ──
const FieldLabel = ({ label, required }) => (
  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
    {label} {required && <span className="text-rose-400">*</span>}
  </label>
);

const TextInput = ({ field, label, required, type = 'text', placeholder = '', ...props }) => {
  const { form, set, errors } = useContext(RHPFormContext);
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <input
        type={type}
        value={form[field]}
        onChange={e => set(field, e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-xl bg-slate-800/60 border text-white placeholder-slate-500 focus:outline-none focus:ring-1 text-sm transition-all ${
          errors[field] ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-700 focus:border-teal-500 focus:ring-teal-500'
        }`}
        {...props}
      />
      {errors[field] && <p className="mt-1 text-xs text-rose-400">{errors[field]}</p>}
    </div>
  );
};

const SelectInput = ({ field, label, required, options, placeholder = 'Select...', ...props }) => {
  const { form, set, errors } = useContext(RHPFormContext);
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <select
        value={form[field]}
        onChange={e => set(field, e.target.value)}
        className={`w-full px-4 py-3 rounded-xl bg-slate-800/60 border text-white focus:outline-none focus:ring-1 text-sm transition-all ${
          errors[field] ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-700 focus:border-teal-500 focus:ring-teal-500'
        }`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {errors[field] && <p className="mt-1 text-xs text-rose-400">{errors[field]}</p>}
    </div>
  );
};

const TextArea = ({ field, label, required, rows = 3, placeholder = '' }) => {
  const { form, set } = useContext(RHPFormContext);
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <textarea
        value={form[field]}
        onChange={e => set(field, e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm transition-all resize-none"
      />
    </div>
  );
};

const Checkbox = ({ field, label }) => {
  const { form, set } = useContext(RHPFormContext);
  return (
    <label className="flex items-center space-x-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 cursor-pointer transition-all group">
      <input
        type="checkbox"
        checked={form[field]}
        onChange={e => set(field, e.target.checked)}
        className="w-4.5 h-4.5 rounded border-slate-600 text-teal-500 focus:ring-teal-500 bg-slate-800"
      />
      <span className="text-sm text-slate-300 group-hover:text-slate-200 font-medium">{label}</span>
    </label>
  );
};

const FileUploadBox = ({ field, label, accept, multi = false }) => {
  const { files, filePreviews, handleFileChange, removeFile } = useContext(RHPFormContext);
  const file = files[field];
  return (
    <div>
      <FieldLabel label={label} />
      <div className="border-2 border-dashed border-slate-700 rounded-xl p-4 text-center hover:border-teal-500/50 transition-all">
        {!multi && file ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {filePreviews[field] ? (
                <img src={filePreviews[field]} alt="" className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <FileText className="w-8 h-8 text-slate-500" />
              )}
              <div className="text-left">
                <p className="text-sm text-slate-300 font-medium truncate max-w-[200px]">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button onClick={() => removeFile(field)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : multi && file?.length > 0 ? (
          <div className="space-y-2">
            {file.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2">
                <span className="text-sm text-slate-300 truncate max-w-[200px]">{f.name}</span>
                <button onClick={() => removeFile(field, i)} className="p-1 rounded hover:bg-rose-500/10 text-rose-400 ml-2">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {file.length < 3 && (
              <label className="block cursor-pointer">
                <span className="text-xs text-teal-400 hover:text-teal-300">+ Add more</span>
                <input type="file" accept={accept} multiple className="hidden" onChange={e => handleFileChange(field, e.target.files, true)} />
              </label>
            )}
          </div>
        ) : (
          <label className="cursor-pointer block py-3">
            <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Click to upload or drag & drop</p>
            <p className="text-xs text-slate-500 mt-1">JPG, PNG, PDF — Max 5 MB</p>
            <input
              type="file"
              accept={accept}
              multiple={multi}
              className="hidden"
              onChange={e => handleFileChange(field, e.target.files, multi)}
            />
          </label>
        )}
      </div>
    </div>
  );
};

const RegisterRHP = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null); // { applicationCode }
  const [globalError, setGlobalError] = useState('');
  const [errors, setErrors] = useState({});

  // Districts & Blocks (from public API)
  const [districts, setDistricts] = useState([]);
  const [blocks, setBlocks] = useState([]);

  // ── Form Data ──
  const [form, setForm] = useState({
    fullName: '', gender: 'male', age: '', dateOfBirth: '', phone: '', email: '',
    aadhaarNumber: '', panNumber: '',
    qualification: '', registrationNumber: '', registrationAuthority: '', yearsOfExperience: '',
    districtId: '', blockId: '', village: '', clinicName: '', address: '', state: 'Bihar', pinCode: '',
    hasConsultationSpace: false, hasScreeningSpace: false, hasElectricity: false,
    hasSmartphone: false, hasInternet: false, storageSpace: '', medicineShop: '',
    healthCampExperience: '', eyeCareExperience: '',
    whyJoinReason: '', patientsPerDay: '',
    willingToInvest: '',
    bankAccountHolder: '', bankName: '', bankAccountNumber: '', bankIfsc: '',
    declarationAgreed: false,
  });

  // File uploads
  const [files, setFiles] = useState({
    photograph: null, aadhaarDoc: null, panDoc: null, registrationCert: null, supportingDocs: []
  });
  const [filePreviews, setFilePreviews] = useState({});

  // ── Load draft from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        setForm(prev => ({ ...prev, ...draft }));
      }
    } catch (e) { /* ignore */ }
  }, []);

  // ── Auto-save draft every 30s ──
  useEffect(() => {
    const timer = setInterval(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    }, 30000);
    return () => clearInterval(timer);
  }, [form]);

  // ── Fetch districts ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API}/public/districts`);
        if (res.data.success) setDistricts(res.data.data);
      } catch (e) { console.error('Load districts error:', e); }
    };
    load();
  }, []);

  // ── Fetch blocks when district changes ──
  useEffect(() => {
    if (!form.districtId) { setBlocks([]); return; }
    const load = async () => {
      try {
        const res = await axios.get(`${API}/public/blocks?districtId=${form.districtId}`);
        if (res.data.success) setBlocks(res.data.data);
      } catch (e) { console.error('Load blocks error:', e); }
    };
    load();
  }, [form.districtId]);

  // ── Field updater ──
  const set = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }, []);

  // ── Validate current step ──
  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!form.fullName.trim()) e.fullName = 'Full Name is required';
      if (!form.phone.trim()) e.phone = 'Mobile Number is required';
      else if (!MOBILE_RE.test(form.phone.replace(/\D/g, '').slice(-10))) e.phone = 'Must be 10 digits';
      if (form.email && !EMAIL_RE.test(form.email)) e.email = 'Invalid email format';
      if (form.aadhaarNumber && !AADHAAR_RE.test(form.aadhaarNumber)) e.aadhaarNumber = 'Must be 12 digits';
      if (form.panNumber && !PAN_RE.test(form.panNumber.toUpperCase())) e.panNumber = 'Invalid PAN format';
      if (form.dateOfBirth && new Date(form.dateOfBirth) > new Date()) e.dateOfBirth = 'Cannot be in the future';
    }
    if (step === 2) {
      if (form.pinCode && !PIN_RE.test(form.pinCode)) e.pinCode = 'Must be 6 digits';
    }
    if (step === 7) {
      if (form.bankIfsc && !IFSC_RE.test(form.bankIfsc.toUpperCase())) e.bankIfsc = 'Invalid IFSC format';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => { if (validateStep()) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const goPrev = () => setStep(s => Math.max(s - 1, 0));

  // ── File handling ──
  const handleFileChange = useCallback((field, fileList, multi = false) => {
    const selectedFiles = Array.from(fileList);
    const validFiles = selectedFiles.filter(f => {
      if (!ALLOWED_TYPES.includes(f.type)) return false;
      if (f.size > MAX_FILE_SIZE) return false;
      return true;
    });

    if (multi) {
      setFiles(prev => ({ ...prev, [field]: [...(prev[field] || []), ...validFiles].slice(0, 3) }));
    } else {
      setFiles(prev => ({ ...prev, [field]: validFiles[0] || null }));
      // Preview for images
      if (validFiles[0] && validFiles[0].type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setFilePreviews(prev => ({ ...prev, [field]: reader.result }));
        reader.readAsDataURL(validFiles[0]);
      } else {
        setFilePreviews(prev => ({ ...prev, [field]: null }));
      }
    }
  }, []);

  const removeFile = useCallback((field, idx = null) => {
    if (idx !== null) {
      setFiles(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== idx) }));
    } else {
      setFiles(prev => ({ ...prev, [field]: null }));
      setFilePreviews(prev => ({ ...prev, [field]: null }));
    }
  }, []);

  // ── Submit ──
  const handleSubmit = async (isDraft = false) => {
    if (!isDraft) {
      // Validate all steps
      for (let s = 0; s < STEPS.length; s++) {
        setStep(s);
        // Validate minimal fields
      }
      if (!form.fullName.trim() || !form.phone.trim()) {
        setStep(0);
        setGlobalError('Please fill in all required fields (Full Name, Mobile Number).');
        return;
      }
      if (!form.declarationAgreed) {
        setGlobalError('You must agree to the declaration before submitting.');
        return;
      }
    }

    setSubmitting(true);
    setGlobalError('');

    try {
      const formData = new FormData();

      // Append all form fields
      for (const [key, val] of Object.entries(form)) {
        if (val !== null && val !== undefined && val !== '') {
          formData.append(key, val);
        }
      }
      formData.append('isDraft', isDraft ? 'true' : 'false');

      // Append files
      if (files.photograph) formData.append('photograph', files.photograph);
      if (files.aadhaarDoc) formData.append('aadhaarDoc', files.aadhaarDoc);
      if (files.panDoc) formData.append('panDoc', files.panDoc);
      if (files.registrationCert) formData.append('registrationCert', files.registrationCert);
      if (files.supportingDocs?.length) {
        files.supportingDocs.forEach(f => formData.append('supportingDocs', f));
      }

      const res = await axios.post(`${API}/rhp/register`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        localStorage.removeItem(DRAFT_KEY);
        if (isDraft) {
          setGlobalError('');
          alert('Draft saved successfully!');
        } else {
          setSubmitSuccess({
            applicationCode: res.data.data.applicationCode,
            fullName: res.data.data.fullName,
          });
        }
      }
    } catch (err) {
      setGlobalError(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    if (!window.confirm('Reset all form data? This action cannot be undone.')) return;
    setForm({
      fullName: '', gender: 'male', age: '', dateOfBirth: '', phone: '', email: '',
      aadhaarNumber: '', panNumber: '',
      qualification: '', registrationNumber: '', registrationAuthority: '', yearsOfExperience: '',
      districtId: '', blockId: '', village: '', clinicName: '', address: '', state: 'Bihar', pinCode: '',
      hasConsultationSpace: false, hasScreeningSpace: false, hasElectricity: false,
      hasSmartphone: false, hasInternet: false, storageSpace: '', medicineShop: '',
      healthCampExperience: '', eyeCareExperience: '',
      whyJoinReason: '', patientsPerDay: '',
      willingToInvest: '',
      bankAccountHolder: '', bankName: '', bankAccountNumber: '', bankIfsc: '',
      declarationAgreed: false,
    });
    setFiles({ photograph: null, aadhaarDoc: null, panDoc: null, registrationCert: null, supportingDocs: [] });
    setFilePreviews({});
    setErrors({});
    setStep(0);
    localStorage.removeItem(DRAFT_KEY);
  };

  // ── Context value (provides form state to module-scope sub-components) ──
  const ctxValue = { form, set, errors, files, filePreviews, handleFileChange, removeFile };

  // ── Success Page ──
  if (submitSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="w-full max-w-md p-8 rounded-2xl glass-panel-dark border border-slate-700/50 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Application Submitted!</h2>
          <p className="text-slate-400 text-sm mb-6">Your RHP application has been submitted successfully. Our team will review it shortly.</p>

          <div className="bg-slate-800/60 rounded-xl p-4 mb-6 border border-slate-700/50">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Application ID</p>
            <p className="text-2xl font-black text-teal-400 tracking-wider">{submitSuccess.applicationCode}</p>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-4 mb-6 border border-slate-700/50">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Applicant</p>
            <p className="text-lg font-bold text-slate-200">{submitSuccess.fullName}</p>
          </div>

          <p className="text-xs text-slate-500 mb-6">Please save your Application ID for future reference.</p>

          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold text-sm shadow-lg shadow-teal-500/20 transition-all"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // ── Step Renderers ──
  const renderStep = () => {
    switch (step) {
      case 0: // Basic Information
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <TextInput field="fullName" label="Full Name" required placeholder="Enter your full name" />
            </div>
            <SelectInput field="gender" label="Gender" options={[
              { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }
            ]} />
            <TextInput field="dateOfBirth" label="Date of Birth" type="date" />
            <TextInput field="phone" label="Mobile Number" required placeholder="10-digit number" maxLength={10} />
            <TextInput field="email" label="Email ID" type="email" placeholder="name@example.com" />
            <TextInput field="aadhaarNumber" label="Aadhaar Number" placeholder="12-digit Aadhaar" maxLength={12} />
            <TextInput field="panNumber" label="PAN Number" placeholder="ABCDE1234F" maxLength={10} />
          </div>
        );

      case 1: // Professional Details
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <TextInput field="qualification" label="Qualification" placeholder="e.g. ASHA Training, ANM Diploma, B.Sc Nursing" />
            </div>
            <TextInput field="registrationNumber" label="Registration Number" placeholder="Professional registration number" />
            <TextInput field="registrationAuthority" label="Registration Authority" placeholder="e.g. Bihar State Medical Council" />
            <TextInput field="yearsOfExperience" label="Years of Experience" type="number" placeholder="0" min="0" />
          </div>
        );

      case 2: // Practice Location
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <TextInput field="clinicName" label="Clinic / Facility Name" placeholder="Name of your clinic or health center" />
            </div>
            <div className="md:col-span-2">
              <TextArea field="address" label="Address" placeholder="Complete address of the practice location" />
            </div>
            <SelectInput field="districtId" label="District" options={districts.map(d => ({ value: d.id, label: d.name }))}
              placeholder="Select District" />
            <TextInput field="state" label="State" placeholder="Bihar" />
            <SelectInput field="blockId" label="Block" options={blocks.map(b => ({ value: b.id, label: b.name }))}
              placeholder={form.districtId ? 'Select Block' : 'Select district first'} disabled={!form.districtId} />
            <TextInput field="pinCode" label="PIN Code" placeholder="6-digit PIN" maxLength={6} />
            <TextInput field="village" label="Village" placeholder="Village name" />
          </div>
        );

      case 3: // Infrastructure
        return (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-slate-300 mb-3">Infrastructure Availability</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Checkbox field="hasConsultationSpace" label="Consultation Space" />
                <Checkbox field="hasScreeningSpace" label="Vision Screening Space" />
                <Checkbox field="hasElectricity" label="Electricity" />
                <Checkbox field="hasSmartphone" label="Smartphone / Tablet" />
                <Checkbox field="hasInternet" label="Internet" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput field="storageSpace" label="Storage Space" placeholder="Describe storage availability" />
              <TextInput field="medicineShop" label="Medicine Shop" placeholder="Nearby medicine shop details" />
            </div>
          </div>
        );

      case 4: // Experience
        return (
          <div className="space-y-4">
            <TextArea field="healthCampExperience" label="Health Camp Experience" rows={4}
              placeholder="Describe any experience conducting or assisting in health camps..." />
            <TextArea field="eyeCareExperience" label="Eye Care Experience" rows={4}
              placeholder="Describe any experience in eye screening, vision testing, or dispensing glasses..." />
          </div>
        );

      case 5: // Interest
        return (
          <div className="space-y-4">
            <TextArea field="whyJoinReason" label="Why do you want to join the program?" rows={4}
              placeholder="Tell us about your motivation to become a Vision Entrepreneur..." />
            <TextInput field="patientsPerDay" label="Expected Patients per Day" type="number" placeholder="0" min="0" />
          </div>
        );

      case 6: // Financial Commitment
        return (
          <div className="space-y-4">
            <FieldLabel label="Are you willing to invest in the program?" />
            <div className="flex space-x-4">
              {['Yes', 'No'].map(opt => (
                <label key={opt} className={`flex items-center space-x-3 px-5 py-3.5 rounded-xl border cursor-pointer transition-all ${
                  form.willingToInvest === opt
                    ? 'bg-teal-500/10 border-teal-500/50 text-teal-300'
                    : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}>
                  <input
                    type="radio"
                    name="willingToInvest"
                    value={opt}
                    checked={form.willingToInvest === opt}
                    onChange={e => set('willingToInvest', e.target.value)}
                    className="text-teal-500 focus:ring-teal-500"
                  />
                  <span className="font-semibold text-sm">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 7: // Bank Details
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput field="bankAccountHolder" label="Account Holder Name" placeholder="As per bank records" />
            <TextInput field="bankName" label="Bank Name" placeholder="e.g. State Bank of India" />
            <TextInput field="bankAccountNumber" label="Account Number" placeholder="Bank account number" />
            <TextInput field="bankIfsc" label="IFSC Code" placeholder="e.g. SBIN0001234" maxLength={11} />
          </div>
        );

      case 8: // Uploads
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FileUploadBox field="photograph" label="Passport Photograph" accept=".jpg,.jpeg,.png" />
              <FileUploadBox field="aadhaarDoc" label="Aadhaar Card" accept=".jpg,.jpeg,.png,.pdf" />
              <FileUploadBox field="panDoc" label="PAN Card" accept=".jpg,.jpeg,.png,.pdf" />
              <FileUploadBox field="registrationCert" label="Registration Certificate (Optional)" accept=".jpg,.jpeg,.png,.pdf" />
            </div>
            <FileUploadBox field="supportingDocs" label="Supporting Documents (Optional, max 3)" accept=".jpg,.jpeg,.png,.pdf" multi />

            {/* Declaration */}
            <div className="mt-6 p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.declarationAgreed}
                  onChange={e => set('declarationAgreed', e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-slate-600 text-teal-500 focus:ring-teal-500 bg-slate-800"
                />
                <span className="text-sm text-slate-300 leading-relaxed">
                  I declare that all information provided is true and correct to the best of my knowledge. I agree to the program terms and conditions.
                </span>
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ── Main Layout ──
  return (
    <RHPFormContext.Provider value={ctxValue}>
      <div className="min-h-screen bg-slate-900">
        {/* Background blobs */}
        <div className="fixed top-10 left-10 w-72 h-72 bg-teal-500 rounded-full mix-blend-multiply filter blur-2xl opacity-5 animate-blob"></div>
        <div className="fixed bottom-10 right-10 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-2xl opacity-5 animate-blob animation-delay-2000"></div>

        <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/login')} className="p-2 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">RHP Registration</h1>
                <p className="text-slate-500 text-xs mt-0.5">Apply to become a Vision Entrepreneur</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-2 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/50">
              <span className="text-teal-400 font-extrabold text-lg tracking-wider">VEP</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3 overflow-x-auto pb-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = i === step;
                const isDone = i < step;
                return (
                  <button
                    key={s.key}
                    onClick={() => { if (i < step || validateStep()) setStep(i); }}
                    className={`flex flex-col items-center min-w-[60px] transition-all ${
                      isActive ? 'text-teal-400' : isDone ? 'text-emerald-400' : 'text-slate-600'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-1.5 border-2 transition-all ${
                      isActive ? 'bg-teal-500/10 border-teal-500' :
                      isDone ? 'bg-emerald-500/10 border-emerald-500' :
                      'bg-slate-800/60 border-slate-700'
                    }`}>
                      {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className="text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap">{s.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Global Error */}
          {globalError && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-rose-300 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{globalError}</span>
              <button onClick={() => setGlobalError('')} className="ml-auto p-1 hover:bg-rose-500/10 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step Content Card */}
          <div className="glass-panel-dark rounded-2xl border border-slate-700/50 p-6 md:p-8 mb-6 shadow-2xl">
            <div className="flex items-center space-x-3 mb-6">
              {React.createElement(STEPS[step].icon, { className: 'w-5 h-5 text-teal-400' })}
              <h2 className="text-lg font-bold text-white">{STEPS[step].label}</h2>
              <span className="text-xs text-slate-500 ml-auto font-semibold">Step {step + 1} of {STEPS.length}</span>
            </div>
            {renderStep()}
          </div>

          {/* Navigation & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {step > 0 && (
              <button onClick={goPrev} className="flex items-center space-x-2 px-5 py-3 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 font-semibold text-sm transition-all">
                <ArrowLeft className="w-4 h-4" /><span>Previous</span>
              </button>
            )}

            <div className="flex-1"></div>

            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-slate-500 hover:text-rose-400 hover:border-rose-500/30 font-semibold text-sm transition-all"
            >
              <RotateCcw className="w-4 h-4" /><span>Reset</span>
            </button>

            <button
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="flex items-center space-x-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 font-semibold text-sm transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" /><span>Save Draft</span>
            </button>

            {step < STEPS.length - 1 ? (
              <button onClick={goNext} className="flex items-center space-x-2 px-5 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold text-sm shadow-lg shadow-teal-500/20 transition-all">
                <span>Next</span><ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{submitting ? 'Submitting...' : 'Submit Application'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </RHPFormContext.Provider>
  );
};

export default RegisterRHP;
