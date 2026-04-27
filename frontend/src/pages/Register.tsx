import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { PenTool, AlertCircle } from 'lucide-react';
import { PageEntrance, MotionButton } from '../components/Motion';

const appleFont = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  backgroundColor: '#FFFFFF',
  border: '1px solid #E8E8ED',
  borderRadius: 8,
  padding: '0 16px',
  fontSize: 15,
  color: '#1D1D1F',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  color: '#1D1D1F',
  marginBottom: 6,
};

function AppleInput({
  id,
  type,
  value,
  onChange,
  required,
  placeholder,
  minLength,
}: {
  id: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      required={required}
      placeholder={placeholder}
      minLength={minLength}
      style={inputStyle}
      onFocus={(e) => {
        e.target.style.borderColor = '#0071E3';
        e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.1)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = '#E8E8ED';
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.email, form.password, form.firstName, form.lastName);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div
      style={{ fontFamily: appleFont, backgroundColor: '#F5F5F7' }}
      className="min-h-screen flex items-center justify-center px-4 py-12"
    >
      <PageEntrance>
        <div className="w-full" style={{ maxWidth: 512 }}>

          {/* Wordmark */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center gap-2 mb-6"
              style={{ color: '#0071E3' }}
            >
              <PenTool
                style={{ width: 28, height: 28, strokeWidth: 1.75 }}
              />
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#1D1D1F',
                  letterSpacing: '-0.3px',
                }}
              >
                eSignatureGO
              </span>
            </div>

            <h1
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: '#1D1D1F',
                letterSpacing: '-0.3px',
                lineHeight: 1.15,
                marginBottom: 8,
              }}
            >
              Create Account
            </h1>
            <p style={{ fontSize: 17, color: '#6E6E73', lineHeight: 1.4 }}>
              Get started with 2 free document credits
            </p>
          </div>

          {/* Card */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 18,
              border: '1px solid #E8E8ED',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              padding: '40px',
            }}
          >
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Error message */}
              {error && (
                <div
                  style={{
                    backgroundColor: 'rgba(182,68,0,0.05)',
                    border: '1px solid rgba(182,68,0,0.2)',
                    borderRadius: 8,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <AlertCircle
                    style={{
                      width: 16,
                      height: 16,
                      color: '#B64400',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  />
                  <span style={{ fontSize: 14, color: '#B64400', lineHeight: 1.4 }}>
                    {error}
                  </span>
                </div>
              )}

              {/* Name row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-firstName" style={labelStyle}>
                    First Name
                  </label>
                  <AppleInput
                    id="reg-firstName"
                    type="text"
                    value={form.firstName}
                    onChange={update('firstName')}
                    required
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label htmlFor="reg-lastName" style={labelStyle}>
                    Last Name
                  </label>
                  <AppleInput
                    id="reg-lastName"
                    type="text"
                    value={form.lastName}
                    onChange={update('lastName')}
                    required
                    placeholder="Smith"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="reg-email" style={labelStyle}>
                  Email
                </label>
                <AppleInput
                  id="reg-email"
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  required
                  placeholder="you@example.com"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="reg-password" style={labelStyle}>
                  Password
                </label>
                <AppleInput
                  id="reg-password"
                  type="password"
                  value={form.password}
                  onChange={update('password')}
                  required
                  placeholder="Minimum 8 characters"
                  minLength={8}
                />
              </div>

              {/* Submit */}
              <div style={{ paddingTop: 4 }}>
                <MotionButton
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: 44,
                    backgroundColor: '#0071E3',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 17,
                    fontWeight: 600,
                    fontFamily: appleFont,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.5 : 1,
                    transition: 'background-color 0.15s ease, opacity 0.15s ease',
                    letterSpacing: '-0.1px',
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                    if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = '#0066CC';
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                    if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = '#0071E3';
                  }}
                >
                  {loading ? 'Creating account…' : 'Create Account'}
                </MotionButton>
              </div>

              {/* Bottom link */}
              <p
                className="text-center"
                style={{ fontSize: 17, color: '#6E6E73', paddingTop: 4 }}
              >
                Already have an account?{' '}
                <Link
                  to="/login"
                  style={{
                    color: '#0071E3',
                    textDecoration: 'none',
                    fontWeight: 400,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                >
                  Sign in
                </Link>
              </p>

            </form>
          </div>

        </div>
      </PageEntrance>
    </div>
  );
}
