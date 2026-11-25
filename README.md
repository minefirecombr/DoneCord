# Discord Chat Pro — versão inicial integrada ao Firebase

Este pacote é um ponto de partida funcional, não uma cópia completa do Discord. Ele contém autenticação, criação de servidores e canais, chat em tempo real, upload limitado, presença básica e uma primeira camada de WebRTC para chamada entre dois participantes.

## 1. O que está e não está implementado

### Implementado no código
- Login e cadastro por e-mail/senha e login anônimo.
- Perfil básico (nome, biografia e status).
- Criação de servidores e canais de texto/voz.
- Lista de servidores e membros.
- Mensagens em tempo real, histórico recente e exclusão da própria mensagem.
- Upload de imagens/PDF/TXT com limite no cliente e nas regras do Storage.
- Presença online/offline básica.
- Base inicial de chamada WebRTC de áudio entre dois participantes, com câmera e compartilhamento de tela no navegador compatível.

### Ainda exige desenvolvimento antes de produção
- Convites com códigos seguros e entrada/saída de servidor.
- Sistema completo de amigos e mensagens privadas.
- Edição de mensagens, respostas, reações, GIFs e notificações push.
- Cargos/permissões granulares, moderação, denúncias, banimento e auditoria.
- Chamadas em grupo escaláveis (SFU, por exemplo LiveKit/mediasoup/Janus).
- TURN com credenciais temporárias; o STUN público sozinho não garante conexão.
- Sinalização WebRTC robusta: transações, expiração, concorrência, reconexão, limpeza de sala e validação de membros.
- Seleção de dispositivos, alternância de câmera frontal/traseira e áudio de sistema.
- Testes reais em navegadores e redes móveis.

**Não use em produção ainda.** As regras incluídas são uma base inicial e precisam ser revisadas e testadas no Firebase Emulator Suite. Em particular, o nó de sinalização WebRTC deve receber autorização mais restrita e TURN deve ser fornecido por backend.

## 2. Configurar o projeto Firebase existente

Projeto: `discord-5d772`  
Realtime Database: `https://discord-5d772-default-rtdb.firebaseio.com`

Não crie outro projeto.

1. Abra https://console.firebase.google.com/
2. Selecione o projeto `discord-5d772`.
3. Em Configurações do projeto > Geral > Seus apps, registre um aplicativo Web (se ainda não existir).
4. Copie a configuração do SDK para `src/firebase.js`. Mantenha `projectId` e `databaseURL` apontando para o projeto informado. Preencha `apiKey`, `storageBucket`, `messagingSenderId` e `appId` com os valores exibidos pelo Firebase.
5. Authentication > Métodos de login: habilite **E-mail/senha** e **Anônimo**.
6. Realtime Database: confirme a URL indicada e publique `database.rules.json` pela aba Regras.
7. Storage: inicialize o Storage no mesmo projeto e publique `storage.rules`.
8. Configure os domínios autorizados do Authentication: inclua o domínio `SEU-USUARIO.github.io` e o domínio de preview que você realmente usar.

A `apiKey` de um app Firebase Web não é uma credencial administrativa. Mesmo assim, não publique service-account keys, tokens privados ou credenciais TURN permanentes no frontend.

## 3. Hospedar no GitHub Pages

1. Envie todos os arquivos e pastas deste pacote para a raiz do repositório.
2. Em Settings > Pages, selecione Deploy from a branch, escolha `main` e `/ (root)`.
3. Aguarde a publicação e abra o endereço HTTPS do GitHub Pages.
4. O navegador precisa carregar os módulos JavaScript via HTTPS. Não abra `index.html` por `file://`.

## 4. WebRTC e TURN

O exemplo usa STUN público somente para testes. Para uso real, contrate ou hospede um serviço TURN (por exemplo coturn ou um provedor gerenciado). Gere credenciais TURN temporárias no backend e entregue-as ao cliente autenticado. Não coloque senha permanente de TURN no JavaScript.

A chamada incluída é apenas uma base 1:1. Para grupos, use SFU; malha P2P completa consome banda e CPU rapidamente. Compartilhamento de tela depende de `getDisplayMedia`, HTTPS, navegador e sistema operacional; em celulares Android pode não estar disponível da mesma forma que em desktop.

## 5. Regras e segurança

As regras são exemplos iniciais. Antes de abrir o site ao público:
- Teste usuários não autenticados, membros, não membros, proprietários e administradores com Firebase Emulator Suite.
- Mova operações privilegiadas para Cloud Functions/servidor confiável.
- Não permita que o cliente atribua a si próprio cargo, banimento ou propriedade.
- Restrinja leitura e escrita da sinalização por participantes da sala.
- Adicione validação de conteúdo, limites de frequência e limpeza de arquivos órfãos.
- Crie política de privacidade, termos de uso e fluxo de denúncia.

## 6. Avisos de compatibilidade

- GitHub Pages é apenas hospedagem estática; não executa Node.js, WebSocket server nem Cloud Functions.
- Firebase Realtime Database pode servir como sinalização inicial, mas não substitui TURN.
- Alguns recursos de mídia exigem permissões e HTTPS.
- O Storage pode exigir ativação de faturamento conforme as condições atuais da conta/projeto.
- A presença atual é básica e pode precisar de tratamento adicional para múltiplas abas/dispositivos.
