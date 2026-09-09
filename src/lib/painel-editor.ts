/**
 * A lógica de um artigo no painel: monta o editor rico, carrega os campos,
 * salva, apaga, e mantém o "Saved" do topo em dia.
 *
 * Vive à parte das páginas porque roda em dois lugares — dentro da gaveta que
 * abre ao clicar numa linha da lista, e na página /painel/artigo.
 *
 * O corpo é gravado como HTML cru e servido assim; a `src/styles/artigo.css`
 * foi medida contra a captura do Framer para estas tags. O TipTap é
 * configurado para produzir só elas: nada de classes próprias no HTML.
 */
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Artigo = {
  slug: string; titulo: string; resumo: string; capa: string;
  capa_largura: number | null; capa_altura: number | null; capa_alt: string;
  corpo: string; autor: string; categoria: string; tempo_leitura: number | null;
  seo_descricao: string | null; tags: string[] | null;
  publicado: boolean; publicado_em: string; atualizado_em: string | null;
};

/** Título → slug: sem acento, sem pontuação, palavras ligadas por hífen. */
export const aSlug = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Minutos de leitura a 200 palavras/min, do texto sem as tags. */
export const minutos = (html: string) => {
  const n = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(n / 200));
};

type Opcoes = {
  supabase: SupabaseClient;
  raiz: ParentNode;           // onde os campos estão (documento ou a gaveta)
  slug: string | null;        // null = artigo novo
  usuario: string;
  aoSalvar: () => void;       // fechar a gaveta, recarregar a lista…
  marcaEstado?: (e: 'limpo' | 'mexido' | 'salvando' | 'salvo') => void;
};

export function montaEditor({ supabase, raiz, slug, usuario, aoSalvar, marcaEstado }: Opcoes) {
  const $ = <T extends HTMLElement>(sel: string) => raiz.querySelector(sel) as T;

  const form = $('#form') as unknown as HTMLFormElement;
  const estado = $('#estado');
  const previa = $('#previa') as HTMLImageElement;
  const area = $('#ed-area');
  const cru = $('#ed-cru') as HTMLTextAreaElement;
  const recado = $('#ed-recado');
  const campoSlug = $('#c-slug') as HTMLInputElement;
  const campoTempo = $('#c-tempo') as HTMLInputElement;
  const tempoAuto = $('#c-tempo-auto') as HTMLInputElement;
  const seo = $('#c-seo-desc') as HTMLTextAreaElement;
  const contaSeo = $('#conta-seo');
  const bloco = $('#ed-bloco') as HTMLSelectElement;

  let capaAtual: { url: string; largura: number | null; altura: number | null } | null = null;
  let carregando = true;

  const mexeu = () => { if (!carregando) marcaEstado?.('mexido'); };

  // ── editor rico ───────────────────────────────────────────
  const editor = new Editor({
    element: area,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },   // o h1 do artigo é o título da página
        link: false,                       // usamos a extensão própria abaixo
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: 'Escreva o artigo aqui…' }),
    ],
    content: '',
    onUpdate: () => { recalcula(); sincroniza(); mexeu(); },
    onSelectionUpdate: sincroniza,
  });

  /** Acende os botões conforme onde o cursor está. */
  function sincroniza() {
    raiz.querySelectorAll<HTMLButtonElement>('.ed__b[data-cmd]').forEach((b) => {
      const c = b.dataset.cmd!;
      const ativo =
        c === 'bold' ? editor.isActive('bold')
        : c === 'italic' ? editor.isActive('italic')
        : c === 'blockquote' ? editor.isActive('blockquote')
        : c === 'bulletList' ? editor.isActive('bulletList')
        : c === 'orderedList' ? editor.isActive('orderedList')
        : c === 'link' ? editor.isActive('link')
        : false;
      b.setAttribute('aria-pressed', String(ativo));
    });
    bloco.value =
      editor.isActive('heading', { level: 2 }) ? 'h2'
      : editor.isActive('heading', { level: 3 }) ? 'h3'
      : editor.isActive('heading', { level: 4 }) ? 'h4'
      : 'p';
  }

  raiz.querySelectorAll<HTMLButtonElement>('.ed__b[data-cmd]').forEach((b) => {
    b.addEventListener('mousedown', (e) => e.preventDefault());  // não perde o cursor
    b.addEventListener('click', () => {
      const c = editor.chain().focus();
      switch (b.dataset.cmd) {
        case 'bold': c.toggleBold().run(); break;
        case 'italic': c.toggleItalic().run(); break;
        case 'blockquote': c.toggleBlockquote().run(); break;
        case 'bulletList': c.toggleBulletList().run(); break;
        case 'orderedList': c.toggleOrderedList().run(); break;
        case 'link': {
          const url = prompt('Endereço do link:', editor.getAttributes('link').href ?? 'https://');
          if (url === null) break;
          if (url === '') c.unsetLink().run();
          else c.setLink({ href: url }).run();
          break;
        }
        case 'imagem': ($('#ed-arquivo') as HTMLInputElement).click(); break;
        case 'html': alternaHtml(); break;
      }
      sincroniza();
    });
  });

  bloco.addEventListener('change', () => {
    const c = editor.chain().focus();
    if (bloco.value === 'p') c.setParagraph().run();
    else c.setHeading({ level: Number(bloco.value.slice(1)) as 2 | 3 | 4 }).run();
  });

  /** Alterna entre escrever e ver o HTML cru. */
  function alternaHtml() {
    if (cru.hidden) {
      cru.value = editor.getHTML();
      cru.hidden = false;
      area.hidden = true;
    } else {
      editor.commands.setContent(cru.value, { emitUpdate: false });
      cru.hidden = true;
      area.hidden = false;
      recalcula();
    }
  }
  cru.addEventListener('input', () => { recalcula(); mexeu(); });

  /** O HTML do corpo, venha do editor ou do modo cru. */
  const corpoAtual = () => (cru.hidden ? editor.getHTML() : cru.value);

  // Imagem no meio do texto: vai para o mesmo bucket das capas.
  const arquivoImagem = $('#ed-arquivo') as HTMLInputElement;
  arquivoImagem.addEventListener('change', async () => {
    const arq = arquivoImagem.files?.[0];
    if (!arq) return;
    recado.textContent = 'Enviando a imagem…';
    try {
      const base = aSlug(arq.name.replace(/\.[^.]+$/, '')) || 'imagem';
      const nome = `corpo/${Date.now()}-${base}.${arq.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('artigos')
        .upload(nome, arq, { contentType: arq.type, upsert: true });
      if (error) throw new Error(error.message);
      const url = supabase.storage.from('artigos').getPublicUrl(nome).data.publicUrl;
      const alt = prompt('O que esta imagem mostra? (para quem não enxerga)') ?? '';
      editor.chain().focus().setImage({ src: url, alt }).run();
      recado.textContent = '';
    } catch (e) {
      recado.textContent = `Não consegui enviar: ${(e as Error).message}`;
    }
    arquivoImagem.value = '';
  });

  // ── tempo de leitura ──────────────────────────────────────
  function recalcula() {
    if (tempoAuto.checked) campoTempo.value = String(minutos(corpoAtual()));
  }
  tempoAuto.addEventListener('change', () => {
    campoTempo.readOnly = tempoAuto.checked;
    recalcula();
  });
  campoTempo.readOnly = true;

  // ── slug ──────────────────────────────────────────────────
  const previaUrl = $('#previa-url');
  const mostraUrl = () => {
    previaUrl.textContent = campoSlug.value
      ? `www.isabellapiresarquitetura.com.br/artigos/${campoSlug.value}`
      : '';
  };
  let slugNaMao = false;
  campoSlug.addEventListener('input', () => { slugNaMao = true; mostraUrl(); mexeu(); });
  (form.titulo as HTMLInputElement).addEventListener('input', () => {
    // Ao editar, o slug não muda sozinho: mexer nele quebra o link publicado.
    if (!slug && !slugNaMao) { campoSlug.value = aSlug((form.titulo as HTMLInputElement).value); mostraUrl(); }
  });

  seo.addEventListener('input', () => { contaSeo.textContent = String(seo.value.length); });
  form.addEventListener('input', mexeu);

  // ── carrega o artigo ──────────────────────────────────────
  async function carrega() {
    if (!slug) {
      (form.publicadoEm as HTMLInputElement).value = new Date().toISOString().slice(0, 10);
      carregando = false;
      return;
    }
    const { data } = await supabase.from('artigos').select('*').eq('slug', slug).single();
    if (!data) { carregando = false; return; }
    const a = data as Artigo;

    (form.titulo as HTMLInputElement).value = a.titulo;
    campoSlug.value = a.slug;
    campoSlug.readOnly = true;
    (form.autor as HTMLInputElement).value = a.autor ?? 'Isabella Pires';
    (form.resumo as HTMLTextAreaElement).value = a.resumo;
    (form.categoria as HTMLSelectElement).value = a.categoria;
    (form.publicadoEm as HTMLInputElement).value = String(a.publicado_em).slice(0, 10);
    (form.capaAlt as HTMLInputElement).value = a.capa_alt;
    (form.publicado as HTMLSelectElement).value = a.publicado ? 'sim' : 'nao';
    editor.commands.setContent(a.corpo ?? '', { emitUpdate: false });
    seo.value = a.seo_descricao ?? '';
    contaSeo.textContent = String(seo.value.length);
    (form.tags as HTMLInputElement).value = (a.tags ?? []).join(', ');

    if (a.tempo_leitura != null) {
      campoTempo.value = String(a.tempo_leitura);
      // Já tem número gravado: respeita o que está lá em vez de recalcular.
      tempoAuto.checked = false;
      campoTempo.readOnly = false;
    } else {
      recalcula();
    }

    capaAtual = { url: a.capa, largura: a.capa_largura, altura: a.capa_altura };
    previa.src = a.capa;
    previa.hidden = false;
    mostraUrl();

    const apagar = $('#apagar') as HTMLButtonElement;
    apagar.hidden = false;
    apagar.addEventListener('click', () => apaga(a.titulo));

    carregando = false;
    marcaEstado?.('limpo');
  }

  // ── prévia da capa escolhida ──────────────────────────────
  (form.capa as HTMLInputElement).addEventListener('change', () => {
    const arquivo = (form.capa as HTMLInputElement).files?.[0];
    if (arquivo) { previa.src = URL.createObjectURL(arquivo); previa.hidden = false; }
  });

  /** Pede à Vercel um build novo. Rascunho não precisa: não aparece no site. */
  async function rebuild(token: string) {
    await fetch('/api/publica', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  async function apaga(titulo: string) {
    if (!slug) return;
    if (!confirm(`Apagar "${titulo}"? Isso não tem volta.`)) return;
    const apagar = $('#apagar') as HTMLButtonElement;
    apagar.disabled = true;
    const { error } = await supabase.from('artigos').delete().eq('slug', slug);
    if (error) {
      estado.textContent = `Não consegui apagar: ${error.message}`;
      apagar.disabled = false;
      return;
    }
    // O artigo saiu do banco, mas a página dele continua no ar até o próximo
    // build — por isso o rebuild aqui também.
    const { data: s } = await supabase.auth.getSession();
    if (s.session) await rebuild(s.session.access_token);
    aoSalvar();
  }

  async function salva(token: string) {
    const titulo = String((form.titulo as HTMLInputElement).value).trim();
    const oSlug = slug ?? aSlug(campoSlug.value || titulo);
    const arquivo = (form.capa as HTMLInputElement).files?.[0];

    let capa = capaAtual?.url;
    let largura = capaAtual?.largura ?? null;
    let altura = capaAtual?.altura ?? null;

    if (arquivo) {
      // O <Image> exige largura e altura de imagem remota; medimos aqui,
      // no navegador, antes de enviar.
      const medida = await new Promise<{ w: number; h: number }>((ok, falha) => {
        const img = new window.Image();
        img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => falha(new Error('não consegui ler a imagem'));
        img.src = URL.createObjectURL(arquivo);
      });
      largura = medida.w;
      altura = medida.h;

      const nome = `${oSlug}-${Date.now()}.${arquivo.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('artigos')
        .upload(`capas/${nome}`, arquivo, { contentType: arquivo.type, upsert: true });
      if (error) throw new Error(`envio da capa: ${error.message}`);
      capa = supabase.storage.from('artigos').getPublicUrl(`capas/${nome}`).data.publicUrl;
    }

    if (!capa) throw new Error('escolha uma imagem de capa.');

    const corpo = corpoAtual();
    const linha = {
      slug: oSlug,
      titulo,
      resumo: String((form.resumo as HTMLTextAreaElement).value).trim(),
      capa,
      capa_largura: largura,
      capa_altura: altura,
      capa_alt: String((form.capaAlt as HTMLInputElement).value).trim(),
      corpo,
      autor: String((form.autor as HTMLInputElement).value).trim() || 'Isabella Pires',
      categoria: String((form.categoria as HTMLSelectElement).value),
      tempo_leitura: Number(campoTempo.value) || minutos(corpo),
      seo_descricao: String(seo.value).trim() || null,
      tags: String((form.tags as HTMLInputElement).value)
        .split(',').map((t) => t.trim()).filter(Boolean),
      // "2026-05-12" vira meio-dia UTC, não meia-noite local: assim o dia
      // gravado é o mesmo que ela digitou, em qualquer fuso.
      publicado_em: new Date(`${String((form.publicadoEm as HTMLInputElement).value)}T12:00:00Z`).toISOString(),
      atualizado_em: new Date().toISOString(),
      publicado: (form.publicado as HTMLSelectElement).value === 'sim',
      criado_por: usuario,
    };

    const { error } = await supabase.from('artigos').upsert(linha, { onConflict: 'slug' });
    if (error) throw new Error(error.message);
    return linha.publicado;
  }

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const botao = form.querySelector('button[type=submit]') as HTMLButtonElement;
    botao.disabled = true;
    marcaEstado?.('salvando');
    estado.textContent = 'Salvando…';
    try {
      const { data: s } = await supabase.auth.getSession();
      const publicado = await salva(s.session!.access_token);
      if (publicado) {
        estado.textContent = 'Salvo. Atualizando o site…';
        await rebuild(s.session!.access_token);
      }
      marcaEstado?.('salvo');
      aoSalvar();
    } catch (e) {
      estado.textContent = `Não deu certo: ${(e as Error).message}`;
      marcaEstado?.('mexido');
      botao.disabled = false;
    }
  });

  carrega();

  return {
    editor,
    /** Solta o TipTap. Sem isto, cada abrir/fechar da gaveta vaza um editor. */
    destroi: () => editor.destroy(),
  };
}
