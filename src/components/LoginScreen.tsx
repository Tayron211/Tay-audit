import React, { useState } from 'react';
import { 
  ShieldCheck, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle
} from 'lucide-react';
import { UpnBrandLogo } from './Navbar';
import type { AuthUser, UserRole } from '../types';

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [usernameInput, setUsernameInput] = useState('Admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detección inteligente del rol según lo que el usuario va escribiendo
  const trimmedUser = usernameInput.trim().toLowerCase();
  const detectedRole: UserRole = (
    trimmedUser.includes('admin') || 
    trimmedUser === 'root' || 
    trimmedUser === 'adm' || 
    trimmedUser === 'super' ||
    trimmedUser === 'tayron'
  ) ? 'admin' : 'user';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const cleanUser = usernameInput.trim();
    const cleanPass = password.trim();

    // Verificación inteligente y segura de credenciales:
    // Admin: clave 210391 (acceso total a todo el sistema)
    // User: clave 1991 (operador TI común, todo excepto eliminar items)
    let authenticatedUser: AuthUser | null = null;

    if (cleanPass === '210391') {
      authenticatedUser = {
        username: cleanUser || 'Admin',
        role: 'admin',
        displayName: cleanUser && cleanUser.toLowerCase() !== 'admin' 
          ? `${cleanUser} (Admin)` 
          : 'Administrador del Sistema',
        loginAt: new Date().toISOString()
      };
    } else if (cleanPass === '1991') {
      authenticatedUser = {
        username: cleanUser || 'User',
        role: 'user',
        displayName: cleanUser && cleanUser.toLowerCase() !== 'user' 
          ? `${cleanUser} (Operador TI)` 
          : 'Operador de Soporte TI',
        loginAt: new Date().toISOString()
      };
    }

    if (authenticatedUser) {
      setTimeout(() => {
        setIsSubmitting(false);
        onLogin(authenticatedUser!);
      }, 250);
    } else {
      setTimeout(() => {
        setIsSubmitting(false);
        setErrorMsg('Usuario o contraseña incorrectos. Verifica tus credenciales de acceso.');
      }, 200);
    }
  };

  return (
    <div className="login-screen-wrapper">
      <div className="login-card-container">
        
        {/* PANEL IZQUIERDO: UNA SOLA PIEZA CONTINUA CON BRANDING INSTITUCIONAL UPN */}
        <div className="login-visual-panel">
          {/* Fondo artístico con sutil malla de circuitos tecnológicos */}
          <div className="login-visual-mesh-bg">
            <svg width="100%" height="100%" viewBox="0 0 400 500" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.12, pointerEvents: 'none' }}>
              <circle cx="200" cy="220" r="160" stroke="#FFB800" strokeWidth="1" strokeDasharray="4 8" />
              <circle cx="200" cy="220" r="110" stroke="#FFB800" strokeWidth="1.5" strokeOpacity="0.4" />
              <circle cx="200" cy="220" r="60" stroke="#FFB800" strokeWidth="1" strokeDasharray="3 6" />
              <path d="M40 220 H360 M200 60 V380" stroke="rgba(255,184,0,0.18)" strokeWidth="1" />
            </svg>
          </div>

          <div className="login-visual-content">
            {/* Tag superior de branding */}
            <div className="login-badge-tag">
              <UpnBrandLogo size={16} color="#FFB800" />
              <span>UNIVERSIDAD PRIVADA DEL NORTE</span>
            </div>

            {/* Emblema central de marca UPN en una sola pieza */}
            <div className="login-brand-monogram-box">
              <div className="login-brand-halo" />
              <div className="login-brand-icon-wrapper">
                <UpnBrandLogo size={82} color="#FFB800" />
              </div>
            </div>

            {/* Titular e identidad institucional nítida y visible */}
            <div className="login-visual-hero">
              <div className="login-visual-title">
                <span className="login-title-white">Portal Corporativo de</span>
                <span className="text-gradient-upn">Auditoría TI & STIVIE</span>
              </div>
              <div className="login-visual-subtitle">
                Sistema Central de Control y Asistencia TI • Campus UPN
              </div>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: FORMULARIO LIMPIO CON DETECCIÓN INTELIGENTE DE ROL */}
        <div className="login-form-panel">
          {/* Encabezado con Logotipo UPN */}
          <div className="login-form-header">
            <div className="login-brand-emblem">
              <UpnBrandLogo size={34} color="#FFB800" />
            </div>
            <h2 className="login-form-title">Iniciar Sesión</h2>
            <p className="login-form-subtitle">
              Portal Institucional TAY-AUDIT • Campus UPN
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="login-form-body">
            
            {/* Campo: Usuario con Detección Automática de Rol */}
            <div className="login-input-group">
              <div className="login-label-row">
                <label className="login-label" htmlFor="login-username">
                  Usuario del Sistema
                </label>
                {/* Indicador inteligente de rol detectado automáticamente */}
                <span className={`login-detected-badge ${detectedRole === 'admin' ? 'admin' : 'user'}`}>
                  {detectedRole === 'admin' ? (
                    <>
                      <ShieldCheck size={12} />
                      <span>Modo Administrador</span>
                    </>
                  ) : (
                    <>
                      <User size={12} />
                      <span>Modo Operador TI</span>
                    </>
                  )}
                </span>
              </div>
              <div className="login-input-wrapper">
                <div className="login-input-icon">
                  {detectedRole === 'admin' ? (
                    <ShieldCheck size={18} color="#FFB800" />
                  ) : (
                    <User size={18} color="#94a3b8" />
                  )}
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Ingresa tu usuario (ej: Admin o tu nombre)"
                  required
                  className="login-input"
                  style={{ paddingLeft: '44px', paddingRight: '16px' }}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Campo: Contraseña (Sin revelar claves ni texto explícito) */}
            <div className="login-input-group">
              <div className="login-label-row">
                <label className="login-label" htmlFor="login-password">
                  Contraseña de Acceso
                </label>
              </div>
              <div className="login-input-wrapper">
                <div className="login-input-icon">
                  <Lock size={18} color="#94a3b8" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="••••••••••••"
                  required
                  className="login-input"
                  style={{ paddingLeft: '44px', paddingRight: '44px' }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-password-toggle"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Alerta de Error si las credenciales fallan */}
            {errorMsg && (
              <div className="login-error-banner animate-shake">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botón Principal de Acceso */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="login-submit-btn"
            >
              <span>{isSubmitting ? 'Verificando acceso...' : 'Ingresar al Portal TI'}</span>
              <ArrowRight size={17} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default LoginScreen;
