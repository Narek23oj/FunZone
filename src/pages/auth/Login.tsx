import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, User, ArrowLeft, ArrowRight, Check } from 'lucide-react';

import { Logo } from '../../components/Logo';

type LoginStep = 'username' | 'password' | 'create_password' | 'register';

export default function Login() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [step, setStep] = useState<LoginStep>('username');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  
  const { checkUsername, login, register, createPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setStep('username');
    setUsername('');
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setUserEmail(undefined);
    setIsRegistered(false);
  }, [isAdminMode]);

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    const normalizedUsername = username.trim().toLowerCase();
    setLoading(true);
    try {
      const result = await checkUsername(normalizedUsername, isAdminMode);
      if (!result.exists) {
        toast.error(isAdminMode ? 'Ադմինիստրատորի հաշիվը չի գտնվել:' : 'Օգտատիրոջ հաշիվը չի գտնվել:');
        return;
      }

      if (result.wrongPortal) {
        const targetPortal = isAdminMode ? 'Օգտատիրոջ' : 'Ադմինիստրատորի';
        toast.error(`Այս հաշիվը գրանցված է որպես ${result.role === 'admin' ? 'ադմինիստրատոր' : 'օգտատեր'}: Խնդրում ենք անցնել ${targetPortal} պորտալ:`);
        return;
      }
      
      setUserEmail((result as any).email);

      if (!result.hasPassword) {
        setStep('create_password');
        toast.info('Առաջին մուտք: Խնդրում ենք ստեղծել գաղտնաբառ:');
      } else {
        setStep('password');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    try {
      await login(username, password, userEmail);
      toast.success(`Բարի գալուստ, ${username}!`);
      navigate(isAdminMode ? '/admin' : '/user');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Գաղտնաբառը պետք է լինի առնվազն 6 նիշ');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Գաղտնաբառերը չեն համընկնում');
      return;
    }

    setLoading(true);
    try {
      await createPassword(username, password, userEmail);
      toast.success('Գաղտնաբառը հաջողությամբ ստեղծվեց: Բարի գալուստ FunZone:');
      navigate(isAdminMode ? '/admin' : '/user');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !name.trim() || !email.trim() || !phone.trim() || !password) return;
    
    if (password.length < 6) {
      toast.error('Գաղտնաբառը պետք է լինի առնվազն 6 նիշ');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Գաղտնաբառերը չեն համընկնում');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: username.trim().toLowerCase(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password
      });
      setIsRegistered(true);
      toast.success('Դուք հաջողությամբ գրանցվել եք համակարգում:');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (isRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md minimal-card text-center py-12"
        >
          <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="text-accent" size={40} />
          </div>
          <h2 className="text-2xl font-bold mb-4">Գրանցումը հաջողվեց</h2>
          <p className="text-secondary mb-8">
            Դուք հաջողությամբ գրանցվել եք համակարգում: Այժմ կարող եք օգտվել FunZone-ի բոլոր հնարավորություններից:
          </p>
          <button
            onClick={() => navigate('/user')}
            className="minimal-button-primary w-full"
          >
            Անցնել Անձնական Էջ
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md minimal-card"
      >
        <div className="flex justify-center mb-10">
          <div className="bg-surface border border-border p-1 rounded-xl flex relative w-full">
            <motion.div 
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-primary rounded-lg"
              animate={{ left: isAdminMode ? '50%' : '4px' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
            <button 
              type="button"
              onClick={() => setIsAdminMode(false)}
              className={`flex-1 py-2.5 text-sm font-medium z-10 transition-colors ${!isAdminMode ? 'text-bg' : 'text-secondary hover:text-primary'}`}
            >
              <div className="flex items-center justify-center gap-2">
                <User size={16} /> Օգտատեր
              </div>
            </button>
            <button 
              type="button"
              onClick={() => setIsAdminMode(true)}
              className={`flex-1 py-2.5 text-sm font-medium z-10 transition-colors ${isAdminMode ? 'text-bg' : 'text-secondary hover:text-primary'}`}
            >
              <div className="flex items-center justify-center gap-2">
                <Shield size={16} /> Ադմին
              </div>
            </button>
          </div>
        </div>

        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <Logo className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-3 tracking-tighter">
            FunZone Group
          </h1>
          <p className="text-secondary text-sm font-medium uppercase tracking-widest">
            {isAdminMode ? 'Ադմինիստրատորի Մուտք' : 'Օգտատիրոջ Մուտք'}
          </p>
        </div>

        <div className="relative min-h-[220px]">
          <AnimatePresence mode="wait">
            {step === 'username' && (
              <motion.form 
                key="username-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleUsernameSubmit} 
                className="space-y-6"
              >
                <div>
                  <input
                    type="text"
                    placeholder="Մուտքանուն"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="minimal-input"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !username}
                  className="minimal-button-primary w-full flex justify-center items-center gap-2"
                >
                  {loading ? 'Ստուգվում է...' : 'Շարունակել'} <ArrowRight size={18} />
                </button>

                {!isAdminMode && (
                  <div className="text-center pt-4 border-t border-border">
                    <p className="text-sm text-secondary mb-3">Դեռ չունե՞ք հաշիվ</p>
                    <button
                      type="button"
                      onClick={() => setStep('register')}
                      className="text-sm font-bold text-primary hover:underline"
                    >
                      Գրանցվել հիմա
                    </button>
                  </div>
                )}
              </motion.form>
            )}

            {step === 'register' && (
              <motion.form 
                key="register-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleRegisterSubmit} 
                className="space-y-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <button type="button" onClick={() => setStep('username')} className="text-secondary hover:text-primary transition-colors">
                    <ArrowLeft size={18} />
                  </button>
                  <span className="text-sm font-medium">Ստեղծել նոր հաշիվ</span>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Անուն Ազգանուն"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="minimal-input"
                    required
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Օգտանուն"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="minimal-input"
                    required
                  />
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Էլ. փոստ"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="minimal-input"
                    required
                  />
                </div>
                <div>
                  <input
                    type="tel"
                    placeholder="Հեռախոսահամար"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="minimal-input"
                    required
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Գաղտնաբառ"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="minimal-input"
                    required
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Հաստատել Գաղտնաբառը"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="minimal-input"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="minimal-button-primary w-full"
                >
                  {loading ? 'Գրանցվում է...' : 'Հաստատել Գրանցումը'}
                </button>
              </motion.form>
            )}

            {step === 'password' && (
              <motion.form 
                key="password-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handlePasswordSubmit} 
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <button type="button" onClick={() => setStep('username')} className="text-secondary hover:text-primary transition-colors">
                    <ArrowLeft size={18} />
                  </button>
                  <span className="text-sm font-medium">{username}</span>
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Գաղտնաբառ"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="minimal-input"
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="minimal-button-primary w-full"
                >
                  {loading ? 'Մուտք է գործվում...' : 'Մուտք Գործել'}
                </button>
              </motion.form>
            )}

            {step === 'create_password' && (
              <motion.form 
                key="create-password-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleCreatePasswordSubmit} 
                className="space-y-4"
              >
                <div className="text-sm text-accent bg-accent/5 p-4 rounded-xl border border-accent/10 mb-4">
                  Բարի գալուստ, {username}: Խնդրում ենք ստեղծել գաղտնաբառ շարունակելու համար:
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Նոր Գաղտնաբառ"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="minimal-input"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Հաստատել Գաղտնաբառը"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="minimal-input"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !password || !confirmPassword}
                  className="minimal-button-primary w-full flex justify-center items-center gap-2"
                >
                  {loading ? 'Պահպանվում է...' : 'Հաստատել և Մուտք Գործել'} <Check size={18} />
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
