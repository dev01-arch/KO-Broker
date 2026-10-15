'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import {
  COMMUNICATION_QUESTIONS,
  EXPERIENCE_QUESTIONS,
  RATING_OPTIONS,
  TEXT_QUESTIONS,
  YES_NO_QUESTIONS,
} from '@/lib/survey/feedback-survey';

const pageStyle = {
  minHeight: '100vh',
  background: '#3d8b9c',
  padding: '28px 16px 48px',
  fontFamily: 'Georgia, "Times New Roman", serif',
  color: '#16324f',
} as const;

const cardStyle = {
  maxWidth: 860,
  margin: '0 auto',
  background: '#f3fbfb',
  borderRadius: 2,
  padding: '36px 40px 28px',
  boxShadow: '0 8px 24px rgba(0,0,0,.12)',
} as const;

const headingStyle = {
  color: '#1a5276',
  fontSize: 18,
  fontWeight: 600,
  margin: '28px 0 8px',
  paddingBottom: 8,
  borderBottom: '1px solid #d5e4ea',
} as const;

function Required() {
  return <span style={{ color: '#c0392b' }}> *</span>;
}

function surveyDateToIso(value: string): string {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function isoToSurveyDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function DateField({
  value,
  onChange,
  fieldStyle,
}: {
  value: string;
  onChange: (value: string) => void;
  fieldStyle: { width: string; maxWidth: number; height: number; border: string; borderRadius: number; padding: string; font: string; background: string };
}) {
  const pickerRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === 'function') {
      try {
        picker.showPicker();
        return;
      } catch {
        picker.focus();
      }
    }
    picker.focus();
  }

  return (
    <label style={{ display: 'block', marginTop: 16 }}>
      Date
      <Required />
      <span style={{ position: 'relative', display: 'block', maxWidth: 280, marginTop: 6 }}>
        <input
          style={{ ...fieldStyle, maxWidth: 'none', width: '100%', paddingRight: 36, boxSizing: 'border-box' }}
          placeholder="DD-MM-YYYY"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          pattern="\d{2}-\d{2}-\d{4}"
          required
        />
        <button
          type="button"
          aria-label="Choose a date"
          onClick={openPicker}
          style={{
            position: 'absolute',
            right: 4,
            top: 4,
            width: 28,
            height: 28,
            border: 0,
            background: 'transparent',
            color: '#1a5276',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={surveyDateToIso(value)}
          onChange={(event) => onChange(isoToSurveyDate(event.target.value))}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
      </span>
      <span style={{ display: 'block', fontSize: 12, color: '#5f7c8a' }}>DD-MM-YYYY</span>
    </label>
  );
}

function RatingTable({
  title,
  questions,
  answers,
  onChange,
}: {
  title: string;
  questions: ReadonlyArray<{ id: string; label: string }>;
  answers: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
  return (
    <section style={{ marginTop: 22 }}>
      <h2 style={{ ...headingStyle, borderBottom: 'none', marginBottom: 10, paddingBottom: 0 }}>
        {title}
        <Required />
      </h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff' }}>
          <thead>
            <tr>
              <th style={{ width: '46%' }} />
              {RATING_OPTIONS.map((option) => (
                <th key={option} style={{ fontWeight: 600, fontSize: 13, padding: '8px 6px', textAlign: 'center', color: '#1a5276' }}>
                  {option}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {questions.map((question) => (
              <tr key={question.id}>
                <td style={{ border: '1px solid #d5e4ea', padding: '10px 12px', background: '#e7f3f6' }}>{question.label}</td>
                {RATING_OPTIONS.map((option) => (
                  <td key={option} style={{ border: '1px solid #d5e4ea', textAlign: 'center', background: '#fff' }}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      aria-label={`${question.label} ${option}`}
                      checked={answers[question.id] === option}
                      onChange={() => onChange(question.id, option)}
                      required
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SurveyPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [firmName, setFirmName] = useState('KO Financials');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (token === 'preview' && process.env.NODE_ENV === 'development') {
      setFirmName('KO Financials');
      setAnswers({ firstName: 'Amira', lastName: 'Khan' });
      setStatus('ready');
      return;
    }
    void (async () => {
      const response = await fetch(`/api/survey/${token}`);
      const payload = await response.json().catch(() => null);
      if (cancelled) return;
      if (!response.ok || !payload?.success) {
        setStatus('error');
        setMessage(payload?.error?.message || 'This survey link is not valid.');
        return;
      }
      setFirmName(payload.data.firmName || 'KO Financials');
      setAnswers({
        firstName: payload.data.firstName || '',
        lastName: payload.data.lastName || '',
      });
      setStatus(payload.data.submitted ? 'done' : 'ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function setAnswer(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    const response = await fetch(`/api/survey/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, comment }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      setMessage(payload?.error?.message || 'The survey could not be saved.');
      return;
    }
    setStatus('done');
  }

  const yesNoLabels: Record<string, string> = {
    recommend: `Would you recommend ${firmName} to friends, relatives or colleagues? If no, please provide details in the comments box at the end.`,
  };

  const fieldStyle = {
    width: '100%',
    maxWidth: 280,
    height: 36,
    border: '1px solid #b7c9d1',
    borderRadius: 2,
    padding: '0 8px',
    font: 'inherit',
    background: '#fff',
  } as const;

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ textAlign: 'center', color: '#1a5276', fontSize: 32, fontWeight: 600, margin: '0 0 8px' }}>
          KO Financials
        </h1>
        {status === 'loading' && <p>Loading the survey…</p>}
        {status === 'error' && <p>{message}</p>}
        {status === 'done' && <p style={{ textAlign: 'center' }}>Thank you. Your feedback has been recorded.</p>}
        {status === 'ready' && (
          <form onSubmit={onSubmit}>
            <h2 style={headingStyle}>Customer Information</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
              <label>
                First Name
                <Required />
                <input
                  style={{ ...fieldStyle, display: 'block', marginTop: 6 }}
                  value={answers.firstName ?? ''}
                  onChange={(event) => setAnswer('firstName', event.target.value)}
                  required
                />
              </label>
              <label>
                Last Name
                <Required />
                <input
                  style={{ ...fieldStyle, display: 'block', marginTop: 6 }}
                  value={answers.lastName ?? ''}
                  onChange={(event) => setAnswer('lastName', event.target.value)}
                  required
                />
              </label>
            </div>
            <DateField
              value={answers.responseDate ?? ''}
              onChange={(value) => setAnswer('responseDate', value)}
              fieldStyle={fieldStyle}
            />

            <h2 style={headingStyle}>Feedback</h2>
            <RatingTable title="Your Experience" questions={EXPERIENCE_QUESTIONS} answers={answers} onChange={setAnswer} />
            <RatingTable title="Communications" questions={COMMUNICATION_QUESTIONS} answers={answers} onChange={setAnswer} />

            <h2 style={headingStyle}>More Details</h2>
            {YES_NO_QUESTIONS.filter((question) => question.id === 'outcome' || question.id === 'support').map((question) => (
              <fieldset key={question.id} style={{ border: 0, margin: '16px 0', padding: 0 }}>
                <legend style={{ fontSize: 15, marginBottom: 8 }}>
                  {question.label}
                  <Required />
                </legend>
                {['Yes', 'No'].map((option) => (
                  <label key={option} style={{ display: 'block', marginTop: 6 }}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={() => setAnswer(question.id, option)}
                      required
                    />{' '}
                    {option}
                  </label>
                ))}
              </fieldset>
            ))}

            {TEXT_QUESTIONS.map((question) => (
              <label key={question.id} style={{ display: 'block', marginTop: 16 }}>
                {question.label}
                <Required />
                <textarea
                  value={answers[question.id] ?? ''}
                  onChange={(event) => setAnswer(question.id, event.target.value)}
                  required
                  rows={5}
                  style={{ display: 'block', width: '100%', marginTop: 8, font: 'inherit', padding: 8, border: '1px solid #b7c9d1' }}
                />
              </label>
            ))}

            {YES_NO_QUESTIONS.filter((question) => question.id === 'value' || question.id === 'recommend').map((question) => (
              <fieldset key={question.id} style={{ border: 0, margin: '18px 0', padding: 0 }}>
                <legend style={{ fontSize: 15, marginBottom: 8 }}>
                  {yesNoLabels[question.id] || question.label}
                  <Required />
                </legend>
                {['Yes', 'No'].map((option) => (
                  <label key={option} style={{ display: 'block', marginTop: 6 }}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={() => setAnswer(question.id, option)}
                      required
                    />{' '}
                    {option}
                  </label>
                ))}
              </fieldset>
            ))}

            <label style={{ display: 'block', marginTop: 8 }}>
              Additional Comments Below:
              <Required />
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                required
                rows={5}
                style={{ display: 'block', width: '100%', marginTop: 8, font: 'inherit', padding: 8, border: '1px solid #b7c9d1' }}
              />
            </label>
            {message && <p>{message}</p>}
            <div style={{ textAlign: 'center', marginTop: 22 }}>
              <button
                type="submit"
                style={{ minWidth: 140, height: 42, border: 0, borderRadius: 2, background: '#1e4d57', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Submit
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
