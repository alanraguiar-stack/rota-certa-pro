

# Plano: Mapa Completo de Adjacência de Bairros

## Levantamento dos Bairros nos Pedidos

Estes são TODOS os bairros que aparecem nos pedidos reais, organizados por cidade e posição geográfica:

### Osasco (12 pedidos) — Norte→Sul/Leste→Oeste
```text
ENTRADA (Leste, divisa SP):
  KM 18 → Quitaúna → Rochdale → Bonfim → I.A.P.I.

CENTRO:
  Umuarama → Centro → Bussocaba → Presidente Altino

SUL (divisa Carapicuíba):
  Veloso → Santa Maria → Aliança → Baronesa

SAÍDA (divisa SP/Barueri):
  Vila Yara → Jaguaré (SP) → Rio Pequeno (SP)
```

**Fluxo lógico de entrega Osasco:**
KM 18 → Quitaúna → Bonfim → I.A.P.I. → Umuarama → Veloso → Santa Maria → Aliança → Baronesa → Centro → Bussocaba → Presidente Altino → Vila Yara

### Carapicuíba (15 pedidos) — Norte→Sul
```text
NORTE (divisa Barueri/Osasco):
  Centro → Vila Maria Helena → Jardim Santa Brígida

CENTRO-NORTE:
  Jardim Novo Horizonte → Jardim Helena → Jardim Marilu

CENTRO-SUL:
  Pousada dos Bandeirantes → Parque Sampaio Viana

SUL (divisa Cotia/Jandira):
  Vila Silviania → Vila Capriotti → Recanto Campy → Parque Roseira → Cidade Ariston
```

### Barueri (4 pedidos)
```text
Vila Universal (norte) → Vila Engenho Novo (centro) → Parque Viana (sul, divisa Jandira)
```

### Jandira (3 pedidos), Itapevi (3), Embu (3), SP (4)
Cada cidade com 1-3 bairros mapeados conforme CEP e posição real.

## O que será feito

Adicionar ~20 bairros ao `NEIGHBORHOOD_NEIGHBORS` em `anchorRules.ts`:

**Osasco (6 novos):** Umuarama, Veloso, Bonfim, I.A.P.I., Aliança, Baronesa

**Carapicuíba (11 novos):** Centro, Vila Maria Helena, Jardim Santa Brígida, Jardim Novo Horizonte, Jardim Helena, Jardim Marilu, Parque Sampaio Viana, Vila Silviania, Vila Capriotti, Recanto Campy, Parque Roseira, Cidade Ariston

**Barueri (2 novos):** Vila Universal, Vila Engenho Novo

**SP (3 novos):** Jardim Adelfiore, Jardim D'Abril, Conjunto Promorar Raposo Tavares

Cada bairro com vizinhos validados pela posição geográfica real (CEP, mapa).

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/lib/anchorRules.ts` | Adicionar ~22 bairros ao mapa `NEIGHBORHOOD_NEIGHBORS` com adjacências corretas |

