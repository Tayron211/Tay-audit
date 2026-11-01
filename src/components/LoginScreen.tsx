import React, { useState } from 'react';
import { 
  ShieldCheck, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle,
  Sparkles,
  Server,
  Cpu
} from 'lucide-react';
import { UpnBrandLogo } from './Navbar';
import type { AuthUser, UserRole } from '../types';

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [usernameInput, setUsernameInput] = useState('Admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setUsernameInput(role === 'admin' ? 'Admin' : 'User');
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const trimmedUser = usernameInput.trim().toLowerCase();
    const trimmedPass = password.trim();

    // Verificación de credenciales solicitadas:
    // Admin: contraseña 210391 (acceso a todo)
    // User: contraseña 1991 (usuario común, todo excepto eliminar items)
    let authenticatedUser: AuthUser | null = null;

    if (
      (trimmedUser === 'admin' && trimmedPass === '210391') ||
      (selectedRole === 'admin' && trimmedPass === '210391')
    ) {
      authenticatedUser = {
        username: 'Admin',
        role: 'admin',
        displayName: 'Administrador del Sistema',
        loginAt: new Date().toISOString()
      };
    } else if (
      (trimmedUser === 'user' && trimmedPass === '1991') ||
      (selectedRole === 'user' && trimmedPass === '1991')
    ) {
      authenticatedUser = {
        username: 'User',
        role: 'user',
        displayName: 'Operador de Soporte TI',
        loginAt: new Date().toISOString()
      };
    } else if (trimmedPass === '210391') {
      // Detección inteligente por contraseña
      authenticatedUser = {
        username: 'Admin',
        role: 'admin',
        displayName: 'Administrador del Sistema',
        loginAt: new Date().toISOString()
      };
    } else if (trimmedPass === '1991') {
      // Detección inteligente por contraseña
      authenticatedUser = {
        username: 'User',
        role: 'user',
        displayName: 'Operador de Soporte TI',
        loginAt: new Date().toISOString()
      };
    }

    if (authenticatedUser) {
      setTimeout(() => {
        setIsSubmitting(false);
        onLogin(authenticatedUser!);
      }, 300);
    } else {
      setTimeout(() => {
        setIsSubmitting(false);
        if (selectedRole === 'admin') {
          setErrorMsg('Contraseña incorrecta para Administrador (Clave requerida: 210391)');
        } else {
          setErrorMsg('Contraseña incorrecta para Usuario Operador (Clave requerida: 1991)');
        }
      }, 250);
    }
  };

  return (
    <div className="login-screen-wrapper">
      <div className="login-card-container">
        
        {/* PANEL IZQUIERDO: BRANDING INSTITUCIONAL UPN & AMBIENTE CYBER-TECH */}
        <div className="login-visual-panel">
          {/* Fondo gradiente y marcas de agua holográficas */}
          <div className="login-visual-overlay" />
          
          <div className="login-visual-watermark">
            <UpnBrandLogo size={280} color="rgba(255, 184, 0, 0.08)" />
          </div>

          <div className="login-visual-content">
            {/* Tag superior */}
            <div className="login-badge-tag">
              <UpnBrandLogo size={18} color="#FFB800" />
              <span>UNIVERSIDAD PRIVADA DEL NORTE</span>
            </div>

            {/* Titular */}
            <h1 className="login-visual-title">
              Portal Corporativo de <span className="text-gradient-upn">Auditoría TI & STIVIE</span>
            </h1>

            <p className="login-visual-desc">
              Gestión centralizada de infraestructura de cómputo, diagnóstico en tiempo real y asistencia técnica en campus.
            </p>

            {/* Badges de características */}
            <div className="login-features-list">
              <div className="login-feature-pill">
                <div className="login-feature-icon-box">
                  <ShieldCheck size={16} color="#FFB800" />
                </div>
                <div>
                  <div className="login-feature-name">Auditoría 1-Clic en Vivo</div>
                  <div className="login-feature-sub">Levantamiento automático de hardware</div>
                </div>
              </div>

              <div className="login-feature-pill">
                <div className="login-feature-icon-box">
                  <Sparkles size={16} color="#38bdf8" />
                </div>
                <div>
                  <div className="login-feature-name">STIVIE IA Integrado</div>
                  <div className="login-feature-sub">Soporte técnico inteligente 24/7</div>
                </div>
              </div>

              <div className="login-feature-pill">
                <div className="login-feature-icon-box">
                  <Server size={16} color="#10b981" />
                </div>
                <div>
                  <div className="login-feature-name">Infraestructura Conectada</div>
                  <div className="login-feature-sub">Control corporativo de activos y sedes</div>
                </div>
              </div>
            </div>

            {/* Pie del panel visual */}
            <div className="login-visual-footer">
              <span>UPN TI • Departamento de Tecnologías de la Información</span>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: FORMULARIO DE ACCESO CON SELECCIÓN DE ROL */}
        <div className="login-form-panel">
          {/* Encabezado del Formulario con Logotipo UPN */}
          <div className="login-form-header">
            <div className="login-brand-emblem">
              <UpnBrandLogo size={32} color="#FFB800" />
            </div>
            <h2 className="login-form-title">Iniciar Sesión</h2>
            <p className="login-form-subtitle">
              Portal Institucional TAY-AUDIT • Campus UPN
            </p>
          </div>

          {/* Selector de Rol: Admin vs User */}
          <div className="login-role-selector">
            <button
              type="button"
              onClick={() => handleRoleSelect('admin')}
              className={`login-role-card ${selectedRole === 'admin' ? 'active-admin' : ''}`}
            >
              <div className="login-role-icon-circle admin">
                <ShieldCheck size={18} />
              </div>
              <div className="login-role-info">
                <div className="login-role-name">Admin</div>
                <div className="login-role-badge">Acceso Total</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('user')}
              className={`login-role-card ${selectedRole === 'user' ? 'active-user' : ''}`}
            >
              <div className="login-role-icon-circle user">
                <User size={18} />
              </div>
              <div className="login-role-info">
                <div className="login-role-name">User</div>
                <div className="login-role-badge user">Operador TI</div>
              </div>
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="login-form-body">
            
            {/* Campo: Usuario */}
            <div className="login-input-group">
              <label className="login-label">
                Usuario del Sistema
              </label>
              <div className="login-input-wrapper">
                <div className="login-input-icon">
                  {selectedRole === 'admin' ? <ShieldCheck size={16} /> : <User size={16} />}
                </div>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Admin o User"
                  required
                  className="login-input"
                />
              </div>
            </div>

            {/* Campo: Contraseña */}
            <div className="login-input-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="login-label">
                  Contraseña de Acceso
                </label>
                <span className="login-hint-badge">
                  {selectedRole === 'admin' ? 'Clave: 210391' : 'Clave: 1991'}
                </span>
              </div>
              <div className="login-input-wrapper">
                <div className="login-input-icon">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder={selectedRole === 'admin' ? 'Ingresa 210391' : 'Ingresa 1991'}
                  required
                  className="login-input"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-password-toggle"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Alerta de Error */}
            {errorMsg && (
              <div className="login-error-banner animate-shake">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Resumen de Permisos según Rol */}
            <div className="login-permissions-box">
              <div className="login-permissions-title">
                {selectedRole === 'admin' ? (
                  <>
                    <ShieldCheck size={13} color="#FFB800" />
                    <span>Permisos de Administrador</span>
                  </>
                ) : (
                  <>
                    <User size={13} color="#38bdf8" />
                    <span>Permisos de Usuario Común</span>
                  </>
                )}
              </div>
              <p className="login-permissions-text">
                {selectedRole === 'admin' 
                  ? 'Acceso irrestricto: Auditoría, Edición, Registro, Control Remoto y Eliminación definitiva de activos.'
                  : 'Acceso operativo: Auditoría, Edición, Registro y Soporte. (La eliminación de equipos está protegida solo para Admin).'
                }
              </p>
            </div>

            {/* Botón Principal de Acceso */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="login-submit-btn"
            >
              <span>{isSubmitting ? 'Verificando...' : 'Ingresar al Portal TI'}</span>
              <ArrowRight size={17} />
            </button>
          </form>

          {/* Footer del Formulario */}
          <div className="login-form-footer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Cpu size={12} color="#FFB800" />
              <span>Universidad Privada del Norte • División TI</span>
            </div>
            <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Tay-Audit & STIVIE v2.5 • Control Corporativo
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

