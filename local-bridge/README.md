# Bridge local do BambuWatch

O BambuWatch foi desenhado para separar a interface hospedada do acesso às impressoras. Um processo executado na mesma rede local das máquinas deve conectar-se ao MQTT da própria impressora e encaminhar apenas telemetria resumida ao dashboard.

## Por que existe um bridge

Uma página hospedada na internet não consegue abrir diretamente uma conexão para os IPs privados da sua casa. O bridge resolve isso mantendo o acesso às impressoras dentro da rede local. Ele não precisa acessar a conta Bambu Handy e não deve enviar imagens, arquivos de impressão ou comandos de controle.

## Fluxo recomendado

1. O bridge roda em um computador, Raspberry Pi ou servidor doméstico na mesma rede das A1 e P1S.
2. Para cada impressora, o bridge abre MQTT com TLS em `mqtt://IP_DA_IMPRESSORA:8883`, usando o usuário `bblp` e o código de acesso local informado pelo próprio dispositivo.
3. O bridge assina o tópico de relatório da impressora e mantém somente campos de status: estado, progresso, nome do trabalho, temperaturas, sinal Wi‑Fi, firmware e horário de leitura.
4. O bridge publica a telemetria no endpoint autenticado do BambuWatch. Credenciais e códigos de acesso permanecem no computador local.
5. Se o bridge parar de enviar por mais de 45 segundos, a interface deve exibir a máquina como desatualizada/offline.

## Princípios de segurança

- Use somente MQTT com TLS e valide o certificado apresentado pela impressora.
- Nunca coloque o código de acesso local no frontend, em variáveis `VITE_*`, no banco público ou em logs.
- Comece apenas com leitura. Não implemente comandos como parar, pausar, reiniciar ou atualizar firmware sem uma etapa de autorização separada.
- Restrinja a saída do bridge a HTTPS para o endpoint do seu dashboard.
- Rotacione o token do bridge e revogue o token quando o computador local deixar de ser confiável.
- A aplicação não tenta contornar proteções do fabricante nem acessar dados de terceiros.

## Estado atual do projeto

A interface está em **modo demonstração** até que o bridge local seja conectado. O contrato TypeScript em `shared/printerTelemetry.ts` já normaliza leituras, limita percentuais e identifica telemetria antiga. A próxima etapa de integração deve adicionar o endpoint autenticado de ingestão e um cliente MQTT local seguindo este documento.

As referências de protocolo usadas no desenho estão documentadas na biblioteca comunitária Bambu Labs API e no OpenBambuAPI. Elas devem ser conferidas novamente antes de colocar o bridge em produção, pois firmware e requisitos de autenticação podem mudar.
