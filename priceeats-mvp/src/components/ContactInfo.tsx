import { CONTACT_EMAIL } from '@/lib/site';

/** 店家聯絡方式：CONTACT_EMAIL 為空字串時顯示「聯絡方式準備中」，不編造 Email */
export function ContactInfo({ email = CONTACT_EMAIL }: { email?: string }) {
  const mail = email.trim();
  return mail ? (
    <p data-testid="contact">
      聯絡信箱：
      <a href={`mailto:${mail}`} className="link-carbon amount">
        {mail}
      </a>
    </p>
  ) : (
    <p data-testid="contact" className="font-bold">
      聯絡方式準備中
    </p>
  );
}
