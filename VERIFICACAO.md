# Registro de verificação — 26/10/2026

- Vitest: 31 testes aprovados, com banco SQLite real e migrations do produto. Cenários A–J e casos adicionais de integridade, concorrência e CSRF.
- TypeScript: `tsc --noEmit` sem erros.
- Build: artefato Worker e frontend gerados pelo helper Sites.
- Banco D1 local: quatro migrations aplicadas e operações de leitura/escrita verificadas.
- Navegador: cadastro sem e-mail, exibição única do código, confirmação, login, gravação do saldo inicial, lançamento pendente, recálculo, onboarding com etapas opcionais, criação de meta (R$ 5.000 / R$ 500 = 10 aportes), cartão, compra de R$ 3.600 em 12 parcelas de R$ 300, detalhes da fatura e pagamento parcial.
- Pagamento parcial: compra manteve seu valor; o pagamento de R$ 100 reduziu o saldo de R$ 6.000 para R$ 5.900 e deixou a dívida restante em aberto, sem criar uma segunda despesa de consumo.
- Layout conferido em viewport mobile e desktop de 1440 pixels; navegação inferior e sidebar aparecem nos respectivos tamanhos.
- Dados usados no navegador são artificiais e restritos ao banco local de QA. O produto publicado inicia sem dados financeiros de demonstração.
- A suíte HTTP é automatizada. A verificação de interface foi executada por automação de navegador durante esta sessão; não há uma suíte Playwright CLI versionada.

A confirmação de publicação é fornecida pelo serviço de hospedagem e pelo estado terminal do deploy. Limitações e configuração detalhadas no README.
## Verificação HTTP em produção

Após o deploy, foram aprovados os testes de cadastro, sessão, onboarding, gravação de lançamento, 12 parcelas exatas, pagamento parcial sem duplicar consumo, aporte/reserva conciliados, logout, persistência entre sessões, recuperação com rotação do código e revogação de sessão, rejeição do código antigo e exportação sem credenciais. A conta temporária usada nessa verificação foi excluída ao final. O teste utilizou o acesso de serviço já provisionado pela hospedagem, sem alterar o público privado do Site.
