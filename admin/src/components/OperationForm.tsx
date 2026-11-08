import { useState, type FormEvent } from 'react';

import { ApiError, api, type Guest } from '../api';
import { formatAmount } from '../format';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { CardForm, CardTitle } from './ui/Card';
import { Field } from './ui/Field';
import { FormRow } from './ui/FormRow';
import styles from './OperationForm.module.css';

type Props = {
  guest: Guest;
  onDone: () => void;
};

const TYPE_LABELS = {
  topup: 'Нарахувати',
  chargeoff: 'Списати',
} as const;

/**
 * Форма ручного нарахування та списання (О5).
 *
 * Підтвердження перед відправкою обов'язкове: операція змінює реальний
 * баланс гостя в Syrve і скасувати її одним рухом не можна.
 */
export const OperationForm = ({ guest, onDone }: Props) => {
  const [type, setType] = useState<'topup' | 'chargeoff'>('topup');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Прибирає повідомлення про попередню операцію, щойно адміністратор
   * почав змінювати форму: інакше "Нараховано 100" висить над формою, у якій
   * уже набирають наступну суму, і виглядає як результат нової операції.
   *
   * Робимо саме в обробниках зміни, а не в useEffect на [type, amount, reason]:
   * після успіху ми самі чистимо суму й причину, і ефект негайно з'їв би
   * повідомлення про успіх.
   */
  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsedAmount = Number(amount.replace(',', '.'));

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Сума має бути більшою за нуль');
      return;
    }

    const confirmed = window.confirm(
      `${TYPE_LABELS[type]} ${formatAmount(parsedAmount)} бонусів гостю ${
        guest.name ?? guest.phoneFormatted
      }?\n\nПричина: ${reason.trim()}`,
    );

    if (!confirmed) return;

    setIsSubmitting(true);

    try {
      const result = await api.applyOperation(
        guest.customerId,
        type,
        parsedAmount,
        reason.trim(),
      );

      setSuccess(
        `${type === 'topup' ? 'Нараховано' : 'Списано'} ${formatAmount(
          result.amount,
        )}. Новий баланс: ${formatAmount(result.balance)}`,
      );
      setAmount('');
      setReason('');
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        // Помилки валідації приходять полями — показуємо всі.
        setError(
          err.fields?.length
            ? err.fields.map((field) => field.message).join('. ')
            : err.message,
        );
      } else {
        setError('Не вдалося виконати операцію');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CardForm onSubmit={handleSubmit}>
      <CardTitle>Нарахування та списання</CardTitle>

      <div className={styles.radioRow}>
        <label className={styles.radio}>
          <input
            type="radio"
            name="type"
            checked={type === 'topup'}
            onChange={() => {
              setType('topup');
              clearFeedback();
            }}
          />
          Нарахувати
        </label>
        <label className={styles.radio}>
          <input
            type="radio"
            name="type"
            checked={type === 'chargeoff'}
            onChange={() => {
              setType('chargeoff');
              clearFeedback();
            }}
          />
          Списати
        </label>
      </div>

      <FormRow>
        <Field
          label="Сума бонусів"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            clearFeedback();
          }}
          placeholder="100"
          required
        />

        <Field
          grow
          label="Причина"
          type="text"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            clearFeedback();
          }}
          placeholder="Вітальний бонус"
          minLength={3}
          maxLength={200}
          required
        />
      </FormRow>

      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Виконуємо…' : TYPE_LABELS[type]}
      </Button>
    </CardForm>
  );
};
