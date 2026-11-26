import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Política de Privacidade" };

const UPDATED = "26 de novembro de 2026";
// TODO(WebCash): confirmar razão social, CNPJ e e-mail do encarregado (DPO) antes de publicar.
const CONTROLLER = "WebCash Company";
const DPO_EMAIL = "privacidade@bookweb.tech";

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <Link href="/login" className="mb-8 inline-flex items-center gap-2.5">
        <Image src="/logo-webcash.png" alt="WebCash Company" width={36} height={36} className="rounded-full" />
        <span className="font-display text-lg font-extrabold">WebAgent</span>
      </Link>
      <h1 className="text-3xl font-extrabold">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted">Atualizada em {UPDATED}. Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>

      <div className="mt-8 flex flex-col gap-7 text-[15px] leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-fg/90 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        <section>
          <h2>1. Quem trata os dados</h2>
          <p>
            O WebAgent é a central de atendimento da {CONTROLLER} (“controladora”). Ele atende os clientes dos sistemas da empresa, como Bookweb e
            Promoforia, por WhatsApp e, futuramente, por outras redes sociais.
          </p>
        </section>
        <section>
          <h2>2. Quais dados usamos</h2>
          <ul>
            <li><b>Clientes que nos chamam:</b> número de telefone, nome exibido no WhatsApp, mensagens, arquivos enviados e datas.</li>
            <li><b>Equipe que usa o painel:</b> nome, e-mail, registros de acesso e ações feitas no sistema.</li>
            <li><b>Navegação no painel:</b> cookies necessários (sessão e sistema ativo) e, se você permitir, de preferência (tema).</li>
          </ul>
        </section>
        <section>
          <h2>3. Para que usamos e com qual base legal</h2>
          <ul>
            <li>Responder pedidos de suporte e executar o contrato com o cliente (art. 7º, V).</li>
            <li>Gerar protocolo e manter histórico do atendimento para cumprir obrigações e defender direitos (art. 7º, II e VI).</li>
            <li>Segurança do painel e prevenção a fraudes (legítimo interesse, art. 7º, IX).</li>
            <li>Mensagens promocionais somente com consentimento, que pode ser retirado a qualquer momento (art. 7º, I e art. 8º, §5º).</li>
          </ul>
        </section>
        <section>
          <h2>4. Como parar de receber mensagens</h2>
          <p>
            Envie <b>SAIR</b> (ou PARAR / STOP) no WhatsApp. O descadastro é registrado na hora e você não recebe mais mensagens automáticas. Para voltar,
            envie <b>VOLTAR</b>.
          </p>
        </section>
        <section>
          <h2>5. Com quem compartilhamos</h2>
          <ul>
            <li><b>WhatsApp (Meta):</b> meio pelo qual as mensagens trafegam.</li>
            <li>
              <b>Supabase:</b> banco de dados e armazenamento, hospedados nos Estados Unidos. A transferência internacional segue o art. 33 da LGPD, com
              cláusulas contratuais e medidas de segurança do fornecedor.
            </li>
            <li><b>Hostinger:</b> servidor onde o painel e a integração rodam.</li>
          </ul>
          <p className="mt-2">Não vendemos dados pessoais.</p>
        </section>
        <section>
          <h2>6. Por quanto tempo guardamos</h2>
          <p>
            Conversas e arquivos ficam guardados pelo prazo definido para cada sistema (padrão de 2 anos) e depois são excluídos ou anonimizados, salvo
            obrigação legal de guarda.
          </p>
        </section>
        <section>
          <h2>7. Seus direitos</h2>
          <p>
            Você pode pedir confirmação, acesso, correção, portabilidade, anonimização ou exclusão dos seus dados e revogar consentimentos (art. 18).
            Respondemos em até 15 dias.
          </p>
        </section>
        <section>
          <h2>8. Segurança</h2>
          <p>
            Acesso por usuário e senha, permissões por sistema, conexões criptografadas (HTTPS), registros de auditoria e telefones parcialmente ocultos
            nas telas da equipe.
          </p>
        </section>
        <section>
          <h2>9. Cookies e cache</h2>
          <p>
            Usamos cookies necessários para manter a sessão e lembrar o sistema ativo, e cache do navegador para carregar o painel mais rápido. Cookies
            de preferência (tema) só com sua permissão. Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros. As fontes do
            painel são servidas pelo próprio WebAgent, sem chamadas ao Google.
          </p>
        </section>
        <section>
          <h2>10. Contato do encarregado (DPO)</h2>
          <p>
            Fale com o encarregado pelo e-mail <span className="font-semibold select-all">{DPO_EMAIL}</span>. Se não ficar satisfeito, você pode procurar
            a Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
        </section>
      </div>
    </main>
  );
}
