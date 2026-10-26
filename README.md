# Fluxo — gestão financeira pessoal

Aplicação integrada em português, com cadastro por usuário/senha, recuperação de conta, banco persistente, orçamento automático, cartões e metas. Não usa dados fictícios para preencher o dashboard.

## Executar localmente

Requisitos: Node.js 24 LTS, npm e Git. O Node 24 também fornece o SQLite usado nos testes de integração.

```powershell
cd C:\Users\lucas\Documents\ChatGPT\Projeto_fin_dash\fluxo
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_neat_nova.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_black_blur.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_clean_lifeguard.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_tiresome_wiccan.sql
npm run dev
```

Abra a URL impressa pelo servidor, normalmente http://127.0.0.1:5173. Aplique cada migration somente uma vez por banco. Os quatro comandos de migration acima são para um banco novo; neste checkout já foram aplicados.

Para testar o artefato de produção localmente, use `npm start` após o build, e abra a URL impressa pelo Wrangler. Desenvolvimento e preview compartilham `.wrangler/state`; não apague essa pasta se quiser preservar os dados locais. O banco de produção é separado.

## Verificação

```powershell
npm test
npm run typecheck
npm run build
```

A suíte Vitest executa cálculos puros e fluxos HTTP contra SQLite real em arquivo temporário, com chaves estrangeiras, transações e reabertura do banco. Não simula cálculos, autorização nem persistência. O adaptador de testes reproduz o contrato de prepared statements/batch do D1; diferenças de runtime são verificadas adicionalmente no Worker/D1 local e no deploy.

Os cenários incluem distribuição, metas, déficit, parcelas e centavos, pagamento parcial, recuperação/rotação/revogação, isolamento entre contas, CSRF, persistência após logout, reservas entre meses, estornos, alterações de recorrência, datas extremas e rate limiting.

## O que está implementado

- Cadastro sem e-mail, usuário normalizado, Argon2id (19 MiB, 2 iterações, paralelismo 1) e salt individual.
- Código de recuperação de 160 bits apresentado uma vez, cópia e download. Apenas SHA-256 do código aleatório é persistido. Uso rotaciona o código e revoga sessões anteriores.
- Sessões opacas aleatórias de 256 bits, verificador no banco, expiração de 30 dias, cookies HttpOnly, SameSite=Strict e Secure em HTTPS.
- Rate limiting persistente por usuário e origem; verificação de Origin em mutações. Nenhuma senha ou código em logs.
- Onboarding em cinco etapas, com possibilidade de pular, múltiplas fontes de renda, saldo inicial e ciclo configurável.
- CRUD de receitas/despesas, confirmação/estorno, duplicação, pesquisa e filtros de data, categoria e situação.
- Recorrências mensais (24 ocorrências) e anuais (3), editáveis por ocorrência ou para o futuro, preservando ocorrências passadas e confirmadas.
- Cartões, compras, até 60 parcelas, revisão manual da primeira fatura, fechamento/vencimento com datas válidas, pagamento parcial e estorno.
- Metas por prazo ou aporte, último aporte limitado ao restante, aportes, retiradas, estorno, histórico, prioridades, pausa, conclusão e arquivo.
- Reservas virtuais com vínculos explícitos aos aportes. Aportes consomem as reservas mais antigas, inclusive de outros meses; estornos restauram os vínculos.
- Dashboard calculado pelo servidor, cobertura das obrigações por prioridade, dinheiro confirmado separado de projeção, explicação da fórmula e diagnóstico determinístico.
- Histórico unificado, limites de categoria, projeção de compromissos de 3/6/12 meses, exportação JSON e exclusão da conta com senha.
- Layout mobile/desktop, tema escuro, labels, foco visível, diálogo nativo com isolamento de foco e respeito a movimento reduzido.

## Arquitetura e integridade

`app/` contém a página e o endpoint HTTP; `components/`, a interface; `lib/finance.ts`, o motor determinístico; `lib/server.ts`, validação/autorização e operações; `lib/security.ts`, credenciais; `db/schema.ts` e `drizzle/`, o esquema e suas migrations.

A aplicação usa React 19, TypeScript, API de rotas no formato App Router, Tailwind/CSS autoral, Lucide, Zod, Drizzle e Cloudflare D1. O runtime de publicação é o Vinext fornecido pelo Sites (atualmente versão beta fixada no lockfile). Essa é uma adaptação da stack sugerida: não utiliza PostgreSQL/Prisma, Auth.js ou Vercel. O build não deve ser publicado diretamente na Vercel sem adaptar as dependências do Worker e do D1.

Todos os valores são centavos inteiros. O saldo é derivado do saldo inicial, movimentos confirmados e pagamentos de fatura. Aportes e reservas não são saídas de caixa. Compras representam consumo, parcelas representam dívida e pagamentos representam caixa: o pagamento não cria nova despesa de consumo.

Toda consulta financeira e mutação filtra o dono no servidor. O backend valida os vínculos antes de criá-los. Mutações relacionadas usam D1 batch atômico e revisão otimista por usuário com token exclusivo; alterações concorrentes retornam 409 sem gravação parcial. As validações de dinheiro livre usam o ciclo atual, independentemente do mês escolhido no navegador.

Política de cartão: compra no dia de fechamento entra no ciclo seguinte. Vencimento menor ou igual ao fechamento pertence ao mês seguinte ao fechamento. Dias inexistentes são limitados ao último dia do mês. Mudanças no cartão não alteram datas de faturas já criadas. Para corrigir compra que participa de fatura com pagamentos, estorne esses pagamentos primeiro.

A projeção desconta obrigações pendentes e vencidas. O dinheiro livre hoje considera o ciclo atual e, ao consultar um ciclo futuro, também seus compromissos. Não assume recebimento de receitas vencidas ou futuras. Projeções de 3/6/12 meses mostram resultado de cada ciclo, sem saldo acumulado ou rentabilidade.

Uma conta financeira principal por usuário no MVP. O dinheiro informado como já guardado precisa estar incluído no saldo inicial. Juros são informados pelo usuário no total final da compra; não há cálculo automático de encargos.

## Configuração e variáveis de ambiente

Não há segredo de aplicação obrigatório: sessões e recuperação usam aleatoriedade criptográfica e verificadores no banco. Não coloque credenciais bancárias ou tokens no frontend.

- Binding obrigatório: `DB` (D1), declarado em `.openai/hosting.json`.
- `WRANGLER_SEND_METRICS`: opcional, desativado por padrão.
- `CLOUDFLARE_CF_FETCH_ENABLED`: opcional para metadados de preview; não é necessário.
- Configuração de perfil local em `.sites-runtime/`, ignorada pelo Git.
- Tokens temporários de publicação devem ser passados ao helper por stdin; nunca gravados no repositório.

## Publicação no Sites

O projeto já tem identidade em `.openai/hosting.json`. Reutilize-a; não crie um segundo Site. O Sites provisiona o banco e aplica as migrations antes de publicar o Worker.

1. Execute testes e typecheck.
2. Execute o build com o helper `build-site.mjs` da instalação do plugin Sites, preservando a integração `sites()` do Vite.
3. Obtenha uma credencial de escrita para o mesmo projeto pelo conector Sites.
4. Use `site-workflow.mjs --project-id <id do manifest>`, passando a credencial por stdin. O helper sincroniza o código e cria um arquivo de publicação com o commit exato.
5. Salve e publique a versão privada usando o conector Sites com o commit e arquivo devolvidos pelo helper.
6. Verifique o estado terminal da publicação antes de divulgar a URL.

O Site é privado por padrão: a hospedagem exige acesso do proprietário via ChatGPT, além do login próprio do Fluxo. O cadastro da aplicação não exige e-mail. O público da hospedagem só deve ser alterado quando solicitado. Para uma oferta aberta a terceiros, também é necessário completar no aviso de privacidade a identidade/contato do responsável e a política de retenção de infraestrutura.

## Limites e próximos passos

P0 implementado no escopo descrito acima. Permanecem fora: frequências semanais/quinzenais automáticas, renovação infinita de recorrências, múltiplas contas/reconciliação avançada, restauração de backup por interface e transferência física de dinheiro. Recorrências têm horizonte explícito e devem ser renovadas ao término. Edição de um aporte é feita pelo estorno do registro e lançamento corrigido, preservando trilha de alterações.

P1/P2 pendentes: simulador de cenários, projeção acumulada com evolução de metas, CSV, PWA, notificações, Open Finance e assistente com IA. O aviso de privacidade não representa certificação de conformidade legal.
