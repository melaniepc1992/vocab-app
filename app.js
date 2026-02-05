const { useState, useEffect } = React;

const STORAGE_KEY = 'vocab_words';
const ITEMS_PER_PAGE = 10;

// Algoritmo de repetición espaciada
const calculateNextReview = (status, lastReview) => {
  const now = new Date();
  const intervals = {
    'no-se': 5 * 60 * 1000,      // 5 minutos
    'algo-se': 24 * 60 * 60 * 1000, // 1 día
    'la-se': Infinity              // No revisar más
  };
  
  if (!lastReview) return now;
  
  const lastReviewDate = new Date(lastReview);
  const nextReviewDate = new Date(lastReviewDate.getTime() + intervals[status]);
  
  return nextReviewDate;
};

function App() {
  const [words, setWords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('todos');
  const [selectedLevel, setSelectedLevel] = useState('todos');
  const [view, setView] = useState('list');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [flashcardWords, setFlashcardWords] = useState([]);
  const [reviewedInSession, setReviewedInSession] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [formData, setFormData] = useState({
    writing: '',
    reading: '',
    meaning: '',
    type: 'sustantivo',
    level: 'N5/HSK1',
    status: 'no-se',
    language: 'japones'
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setWords(JSON.parse(stored));
    }
  }, []);

  const saveWords = (updatedWords) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedWords));
    setWords(updatedWords);
  };

  const handleSubmit = () => {
    if (!formData.writing || !formData.reading || !formData.meaning) {
      alert('Por favor completa todos los campos');
      return;
    }

    const now = new Date().toISOString();

    if (editingId) {
      const updated = words.map(w => 
        w.id === editingId ? { 
          ...formData, 
          id: editingId,
          createdAt: w.createdAt
        } : w
      );
      saveWords(updated);
      setEditingId(null);
    } else {
      const newWord = {
        ...formData,
        id: Date.now().toString(),
        createdAt: now,
        lastReview: null,
        nextReview: now,
        reviewCount: 0
      };
      saveWords([newWord, ...words]);
    }
    
    setFormData({
      writing: '',
      reading: '',
      meaning: '',
      type: 'sustantivo',
      level: 'N5/HSK1',
      status: 'no-se',
      language: 'japones'
    });
    setShowForm(false);
  };

  const handleEdit = (word) => {
    setFormData({
      writing: word.writing,
      reading: word.reading,
      meaning: word.meaning,
      type: word.type,
      level: word.level,
      status: word.status || 'no-se',
      language: word.language || 'japones'
    });
    setEditingId(word.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (confirm('¿Eliminar esta palabra?')) {
      saveWords(words.filter(w => w.id !== id));
    }
  };

  const updateWordStatus = (wordId, newStatus) => {
    const now = new Date().toISOString();
    const updated = words.map(w => {
      if (w.id === wordId) {
        const nextReview = calculateNextReview(newStatus, now);
        return {
          ...w,
          status: newStatus,
          lastReview: now,
          nextReview: nextReview.toISOString(),
          reviewCount: (w.reviewCount || 0) + 1
        };
      }
      return w;
    });
    saveWords(updated);
    setReviewedInSession([...reviewedInSession, wordId]);
  };

  const updateWordField = (wordId, field, value) => {
    const updated = words.map(w => 
      w.id === wordId ? { ...w, [field]: value } : w
    );
    saveWords(updated);
  };

  // Filtrar por idioma Y nivel
  const filteredWords = words.filter(w => {
    const languageMatch = selectedLanguage === 'todos' || w.language === selectedLanguage;
    const levelMatch = selectedLevel === 'todos' || w.level === selectedLevel;
    return languageMatch && levelMatch;
  });

  // Paginación
  const totalPages = Math.ceil(filteredWords.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedWords = filteredWords.slice(startIndex, endIndex);

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLanguage, selectedLevel]);

  const startFlashcards = () => {
    const now = new Date();
    
    const needReview = filteredWords.filter(w => {
      if (w.status === 'excluir') return false;
      if (w.status === 'la-se') return false;
      
      const nextReviewDate = w.nextReview ? new Date(w.nextReview) : new Date(0);
      return now >= nextReviewDate;
    });

    if (needReview.length === 0) {
      alert('¡Felicidades! No hay palabras pendientes de repaso con estos filtros.');
      return;
    }

    const sorted = needReview.sort((a, b) => {
      if (a.status === 'no-se' && b.status !== 'no-se') return -1;
      if (a.status !== 'no-se' && b.status === 'no-se') return 1;
      return Math.random() - 0.5;
    });

    setFlashcardWords(sorted);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setReviewedInSession([]);
    setView('flashcards');
  };

  const nextCard = () => {
    setShowAnswer(false);
    
    if (currentCardIndex < flashcardWords.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    } else {
      const toRepeat = flashcardWords.filter(w => 
        w.status === 'algo-se' && !reviewedInSession.includes(w.id)
      );
      
      if (toRepeat.length > 0) {
        setFlashcardWords([...flashcardWords, ...toRepeat]);
        setCurrentCardIndex(currentCardIndex + 1);
      } else {
        alert('¡Sesión de repaso completada! 🎉');
        setView('list');
      }
    }
  };

  const handleStatusUpdate = (newStatus) => {
    const currentWord = flashcardWords[currentCardIndex];
    updateWordStatus(currentWord.id, newStatus);
    
    const updatedFlashcards = flashcardWords.map(w => 
      w.id === currentWord.id ? { ...w, status: newStatus } : w
    );
    setFlashcardWords(updatedFlashcards);
    
    nextCard();
  };

  const languageStats = {
    japones: words.filter(w => w.language === 'japones').length,
    chino: words.filter(w => w.language === 'chino').length,
    coreano: words.filter(w => w.language === 'coreano').length,
    otro: words.filter(w => w.language === 'otro').length
  };

  const uniqueLevels = [...new Set(words.map(w => w.level))].sort();

  const needsReviewCount = filteredWords.filter(w => {
    if (w.status === 'excluir' || w.status === 'la-se') return false;
    const now = new Date();
    const nextReviewDate = w.nextReview ? new Date(w.nextReview) : new Date(0);
    return now >= nextReviewDate;
  }).length;

  const formatDate = (dateString) => {
    if (!dateString) return 'Sin fecha';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Función para exportar datos
  const exportData = () => {
    const dataStr = JSON.stringify(words, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vocabulario-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert('✅ Datos exportados correctamente');
    setShowExportMenu(false);
  };

  // Función para importar datos
  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedWords = JSON.parse(e.target.result);
        
        if (!Array.isArray(importedWords)) {
          alert('❌ Archivo inválido');
          return;
        }

        // Preguntar si sobrescribir o combinar
        const shouldMerge = confirm(
          `¿Cómo quieres importar?\n\n` +
          `OK = COMBINAR con palabras existentes (${words.length} palabras)\n` +
          `Cancelar = REEMPLAZAR todas las palabras actuales\n\n` +
          `El archivo contiene ${importedWords.length} palabras`
        );

        if (shouldMerge) {
          // Combinar evitando duplicados
          const existingIds = new Set(words.map(w => w.id));
          const newWords = importedWords.filter(w => !existingIds.has(w.id));
          const combined = [...words, ...newWords];
          saveWords(combined);
          alert(`✅ Importado correctamente\n\nAgregadas: ${newWords.length} palabras nuevas\nTotal: ${combined.length} palabras`);
        } else {
          // Reemplazar todo
          saveWords(importedWords);
          alert(`✅ Datos reemplazados\n\nAhora tienes ${importedWords.length} palabras`);
        }
        
        setShowExportMenu(false);
      } catch (error) {
        alert('❌ Error al importar: Archivo corrupto o inválido');
        console.error(error);
      }
    };
    reader.readAsText(file);
  };

  // Función para limpiar todos los datos
  const clearAllData = () => {
    if (confirm('⚠️ ¿ELIMINAR TODAS LAS PALABRAS?\n\nEsta acción NO se puede deshacer.\n\nRecomendamos exportar primero.')) {
      if (confirm('🔴 ÚLTIMA CONFIRMACIÓN\n\n¿Estás SEGURA de eliminar todo?')) {
        saveWords([]);
        alert('✅ Todos los datos han sido eliminados');
        setShowExportMenu(false);
      }
    }
  };

  // Estadísticas generales
  const stats = {
    total: words.length,
    porIdioma: languageStats,
    porEstado: {
      noSe: words.filter(w => w.status === 'no-se').length,
      algoSe: words.filter(w => w.status === 'algo-se').length,
      laSe: words.filter(w => w.status === 'la-se').length,
      excluidas: words.filter(w => w.status === 'excluir').length,
    },
    totalRevisiones: words.reduce((sum, w) => sum + (w.reviewCount || 0), 0),
  };

  if (view === 'flashcards') {
    if (currentCardIndex >= flashcardWords.length) {
      return (
        <div style={styles.flashcardContainer}>
          <div style={styles.completedCard}>
            <h2>🎉 ¡Repaso completado!</h2>
            <p>Has revisado todas las palabras pendientes</p>
            <button onClick={() => setView('list')} style={styles.revealButton}>
              Volver al listado
            </button>
          </div>
        </div>
      );
    }

    const currentWord = flashcardWords[currentCardIndex];
    
    return (
      <div style={styles.flashcardContainer}>
        <div style={styles.flashcardHeader}>
          <button onClick={() => setView('list')} style={styles.backButton}>
            ← Volver
          </button>
          <span style={styles.counter}>
            {currentCardIndex + 1} / {flashcardWords.length}
          </span>
          <button onClick={startFlashcards} style={styles.backButton}>
            🔄 Reiniciar
          </button>
        </div>

        <div style={styles.flashcard}>
          <div style={styles.languageTag}>
            <text style={styles.languageTagText}>
              {currentWord.language === 'japones' && '🇯🇵 Japonés'}
              {currentWord.language === 'chino' && '🇨🇳 Chino'}
              {currentWord.language === 'coreano' && '🇰🇷 Coreano'}
              {currentWord.language === 'otro' && '🌐 Otro'}
            </text>
          </div>
          
          <h2 style={styles.writing}>{currentWord.writing}</h2>
          
          {showAnswer && (
            <div style={styles.answer}>
              <p style={styles.reading}>{currentWord.reading}</p>
              <p style={styles.meaning}>{currentWord.meaning}</p>
              <div style={styles.tags}>
                <span style={styles.tag}>{currentWord.type}</span>
                <span style={styles.tag}>{currentWord.level}</span>
              </div>
              <p style={{fontSize: '12px', color: '#999', marginTop: '15px'}}>
                Revisiones: {currentWord.reviewCount || 0}
              </p>
            </div>
          )}

          <button onClick={() => setShowAnswer(!showAnswer)} style={styles.revealButton}>
            {showAnswer ? '👁️ Ocultar' : '👁️ Ver Respuesta'}
          </button>

          {showAnswer && (
            <div style={styles.statusButtons}>
              <button 
                onClick={() => handleStatusUpdate('no-se')} 
                style={{...styles.statusButton, background: '#fee2e2', color: '#991b1b'}}>
                ❌ No la sé
                <div style={{fontSize: '10px', marginTop: '3px'}}>Revisar en 5 min</div>
              </button>
              <button 
                onClick={() => handleStatusUpdate('algo-se')} 
                style={{...styles.statusButton, background: '#fef3c7', color: '#92400e'}}>
                ⚠️ Algo sé
                <div style={{fontSize: '10px', marginTop: '3px'}}>Revisar mañana</div>
              </button>
              <button 
                onClick={() => handleStatusUpdate('la-se')} 
                style={{...styles.statusButton, background: '#d1fae5', color: '#065f46'}}>
                ✅ La sé
                <div style={{fontSize: '10px', marginTop: '3px'}}>No revisar más</div>
              </button>
            </div>
          )}
        </div>

        <div style={styles.navigation}>
          <button 
            onClick={() => {
              if (currentCardIndex > 0) {
                setCurrentCardIndex(currentCardIndex - 1);
                setShowAnswer(false);
              }
            }}
            disabled={currentCardIndex === 0}
            style={{...styles.navButton, opacity: currentCardIndex === 0 ? 0.5 : 1}}>
            ← Anterior
          </button>
          <button 
            onClick={nextCard}
            style={styles.navButton}>
            Siguiente →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📚 Mi Vocabulario</h1>
        <p style={styles.subtitle}>
          {words.length} palabras totales • {filteredWords.length} filtradas
          {needsReviewCount > 0 && ` • ${needsReviewCount} pendientes de repaso`}
        </p>
      </div>

      <div style={styles.filterSection}>
        <h3 style={styles.filterTitle}>🌐 Filtrar por idioma:</h3>
        <div style={styles.filters}>
          <button 
            onClick={() => setSelectedLanguage('todos')}
            style={{...styles.filterBtn, ...(selectedLanguage === 'todos' ? styles.filterActive : {})}}>
            Todos ({words.length})
          </button>
          <button 
            onClick={() => setSelectedLanguage('japones')}
            style={{...styles.filterBtn, ...(selectedLanguage === 'japones' ? styles.filterActive : {})}}>
            🇯🇵 Japonés ({languageStats.japones})
          </button>
          <button 
            onClick={() => setSelectedLanguage('chino')}
            style={{...styles.filterBtn, ...(selectedLanguage === 'chino' ? styles.filterActive : {})}}>
            🇨🇳 Chino ({languageStats.chino})
          </button>
          <button 
            onClick={() => setSelectedLanguage('coreano')}
            style={{...styles.filterBtn, ...(selectedLanguage === 'coreano' ? styles.filterActive : {})}}>
            🇰🇷 Coreano ({languageStats.coreano})
          </button>
          <button 
            onClick={() => setSelectedLanguage('otro')}
            style={{...styles.filterBtn, ...(selectedLanguage === 'otro' ? styles.filterActive : {})}}>
            🌐 Otro ({languageStats.otro})
          </button>
        </div>
      </div>

      {uniqueLevels.length > 0 && (
        <div style={styles.filterSection}>
          <h3 style={styles.filterTitle}>📊 Filtrar por nivel:</h3>
          <div style={styles.filters}>
            <button 
              onClick={() => setSelectedLevel('todos')}
              style={{...styles.filterBtn, ...(selectedLevel === 'todos' ? styles.filterActive : {})}}>
              Todos los niveles
            </button>
            {uniqueLevels.map(level => (
              <button 
                key={level}
                onClick={() => setSelectedLevel(level)}
                style={{...styles.filterBtn, ...(selectedLevel === level ? styles.filterActive : {})}}>
                {level}
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div style={styles.form}>
          <h3 style={styles.formTitle}>
            {editingId ? '✏️ Editar Palabra' : '➕ Nueva Palabra'}
          </h3>
          
          <select 
            value={formData.language}
            onChange={e => setFormData({...formData, language: e.target.value})}
            style={styles.input}>
            <option value="japones">🇯🇵 Japonés</option>
            <option value="chino">🇨🇳 Chino</option>
            <option value="coreano">🇰🇷 Coreano</option>
            <option value="otro">🌐 Otro</option>
          </select>

          <input 
            type="text"
            placeholder="Escritura (Kanji/Hanzi/Hangul)"
            value={formData.writing}
            onChange={e => setFormData({...formData, writing: e.target.value})}
            style={styles.input}
          />

          <input 
            type="text"
            placeholder="Lectura (Hiragana/Pinyin/Romanización)"
            value={formData.reading}
            onChange={e => setFormData({...formData, reading: e.target.value})}
            style={styles.input}
          />

          <input 
            type="text"
            placeholder="Significado"
            value={formData.meaning}
            onChange={e => setFormData({...formData, meaning: e.target.value})}
            style={styles.input}
          />

          <select 
            value={formData.type}
            onChange={e => setFormData({...formData, type: e.target.value})}
            style={styles.input}>
            <option value="sustantivo">Sustantivo</option>
            <option value="verbo">Verbo</option>
            <option value="adjetivo">Adjetivo</option>
            <option value="adverbio">Adverbio</option>
            <option value="particula">Partícula</option>
            <option value="expresion">Expresión</option>
            <option value="otro">Otro</option>
          </select>

          <select 
            value={formData.level}
            onChange={e => setFormData({...formData, level: e.target.value})}
            style={styles.input}>
            <option value="N5/HSK1">N5 / HSK1</option>
            <option value="N4/HSK2">N4 / HSK2</option>
            <option value="N3/HSK3">N3 / HSK3</option>
            <option value="N2/HSK4">N2 / HSK4</option>
            <option value="N1/HSK5">N1 / HSK5</option>
            <option value="HSK6">HSK6</option>
            <option value="TOPIK1">TOPIK 1</option>
            <option value="TOPIK2">TOPIK 2</option>
          </select>

          <select 
            value={formData.status}
            onChange={e => setFormData({...formData, status: e.target.value})}
            style={styles.input}>
            <option value="no-se">❌ No la sé</option>
            <option value="algo-se">⚠️ Algo sé</option>
            <option value="la-se">✅ La sé</option>
            <option value="excluir">🚫 Excluir</option>
          </select>

          <div style={styles.formButtons}>
            <button onClick={handleSubmit} style={styles.saveBtn}>
              {editingId ? 'Actualizar' : 'Guardar'}
            </button>
            <button onClick={() => {
              setShowForm(false);
              setEditingId(null);
              setFormData({
                writing: '',
                reading: '',
                meaning: '',
                type: 'sustantivo',
                level: 'N5/HSK1',
                status: 'no-se',
                language: 'japones'
              });
            }} style={styles.cancelBtn}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={styles.actionButtons}>
        {!showForm && (
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>
            ➕ Nueva Palabra
          </button>
        )}
        <button onClick={startFlashcards} style={styles.flashcardBtn}>
          🧠 Repasar {needsReviewCount > 0 && `(${needsReviewCount})`}
        </button>
        <button onClick={() => setShowExportMenu(true)} style={styles.exportBtn}>
          💾 Datos
        </button>
      </div>

      <div style={styles.wordsList}>
        {filteredWords.length === 0 ? (
          <div style={styles.empty}>
            <p>No hay palabras con estos filtros</p>
            <p style={{fontSize: '14px', color: '#999', marginTop: '10px'}}>
              Intenta cambiar los filtros o agrega nuevas palabras
            </p>
          </div>
        ) : (
          <>
            {paginatedWords.map(word => (
              <div key={word.id} style={styles.wordCard}>
                <div style={{flex: 1}}>
                  <div style={styles.wordHeader}>
                    <h3 style={styles.cardWriting}>{word.writing}</h3>
                    <button 
                      onClick={() => handleEdit(word)} 
                      style={styles.editBtn}
                      title="Editar palabra">
                      ✏️
                    </button>
                  </div>
                  <p style={styles.cardReading}>{word.reading}</p>
                  <p style={styles.cardMeaning}>{word.meaning}</p>
                  
                  <div style={styles.quickEdit}>
                    <select 
                      value={word.status || 'no-se'}
                      onChange={(e) => updateWordField(word.id, 'status', e.target.value)}
                      style={styles.quickSelect}>
                      <option value="no-se">❌ No la sé</option>
                      <option value="algo-se">⚠️ Algo sé</option>
                      <option value="la-se">✅ La sé</option>
                      <option value="excluir">🚫 Excluir</option>
                    </select>
                  </div>

                  <div style={styles.cardTags}>
                    <span style={styles.cardTag}>
                      {word.language === 'japones' && '🇯🇵'}
                      {word.language === 'chino' && '🇨🇳'}
                      {word.language === 'coreano' && '🇰🇷'}
                      {word.language === 'otro' && '🌐'}
                      {' '}{word.language}
                    </span>
                    <span style={styles.cardTag}>{word.type}</span>
                    <span style={styles.cardTag}>{word.level}</span>
                    <span style={{...styles.cardTag, fontSize: '11px', opacity: 0.7}}>
                      📅 {formatDate(word.createdAt)}
                    </span>
                  </div>
                  
                  {word.reviewCount > 0 && (
                    <p style={{fontSize: '11px', color: '#999', marginTop: '8px'}}>
                      Revisiones: {word.reviewCount} • Último repaso: {formatDate(word.lastReview)}
                    </p>
                  )}
                </div>
                
                <button onClick={() => handleDelete(word.id)} style={styles.deleteBtn}>
                  🗑️
                </button>
              </div>
            ))}

            {/* Paginación */}
            {totalPages > 1 && (
              <div style={styles.pagination}>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{...styles.pageBtn, ...(currentPage === 1 ? styles.pageBtnDisabled : {})}}>
                  ← Anterior
                </button>

                <div style={styles.pageInfo}>
                  <div style={styles.pageText}>Página {currentPage} de {totalPages}</div>
                  <div style={styles.pageSubtext}>
                    Mostrando {startIndex + 1}-{Math.min(endIndex, filteredWords.length)} de {filteredWords.length}
                  </div>
                </div>

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{...styles.pageBtn, ...(currentPage === totalPages ? styles.pageBtnDisabled : {})}}>
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Exportación/Importación */}
      {showExportMenu && (
        <div style={styles.modalOverlay} onClick={() => setShowExportMenu(false)}>
          <div style={styles.exportModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.exportHeader}>
              <h2 style={styles.exportTitle}>💾 Gestión de Datos</h2>
              <button onClick={() => setShowExportMenu(false)} style={styles.closeBtn}>✕</button>
            </div>

            {/* Estadísticas */}
            <div style={styles.statsSection}>
              <h3 style={styles.statsTitle}>📊 Estadísticas</h3>
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statNumber}>{stats.total}</div>
                  <div style={styles.statLabel}>Palabras totales</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statNumber}>{stats.totalRevisiones}</div>
                  <div style={styles.statLabel}>Revisiones totales</div>
                </div>
              </div>

              <div style={styles.statsRow}>
                <div style={styles.miniStat}>
                  <span style={{...styles.statusDot, background: '#fee2e2'}}></span>
                  No sé: {stats.porEstado.noSe}
                </div>
                <div style={styles.miniStat}>
                  <span style={{...styles.statusDot, background: '#fef3c7'}}></span>
                  Algo sé: {stats.porEstado.algoSe}
                </div>
                <div style={styles.miniStat}>
                  <span style={{...styles.statusDot, background: '#d1fae5'}}></span>
                  La sé: {stats.porEstado.laSe}
                </div>
              </div>

              <div style={styles.statsRow}>
                <div style={styles.miniStat}>🇯🇵 {stats.porIdioma.japones}</div>
                <div style={styles.miniStat}>🇨🇳 {stats.porIdioma.chino}</div>
                <div style={styles.miniStat}>🇰🇷 {stats.porIdioma.coreano}</div>
                <div style={styles.miniStat}>🌐 {stats.porIdioma.otro}</div>
              </div>
            </div>

            {/* Opciones de exportación/importación */}
            <div style={styles.exportOptions}>
              <button onClick={exportData} style={styles.exportOptionBtn}>
                <span style={styles.exportIcon}>📥</span>
                <div>
                  <div style={styles.exportOptionTitle}>Exportar Datos</div>
                  <div style={styles.exportOptionDesc}>Descargar backup en formato JSON</div>
                </div>
              </button>

              <label style={styles.exportOptionBtn}>
                <span style={styles.exportIcon}>📤</span>
                <div>
                  <div style={styles.exportOptionTitle}>Importar Datos</div>
                  <div style={styles.exportOptionDesc}>Cargar backup desde archivo</div>
                </div>
                <input 
                  type="file" 
                  accept=".json"
                  onChange={importData}
                  style={{display: 'none'}}
                />
              </label>

              <button onClick={clearAllData} style={{...styles.exportOptionBtn, ...styles.dangerBtn}}>
                <span style={styles.exportIcon}>🗑️</span>
                <div>
                  <div style={styles.exportOptionTitle}>Eliminar Todo</div>
                  <div style={styles.exportOptionDesc}>Borrar todas las palabras (irreversible)</div>
                </div>
              </button>
            </div>

            <div style={styles.exportFooter}>
              <p style={styles.exportNote}>
                💡 <strong>Consejo:</strong> Exporta tus datos regularmente para tener un backup seguro.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '20px', maxWidth: '800px', margin: '0 auto', paddingBottom: '60px' },
  header: { background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  title: { fontSize: '28px', fontWeight: 'bold', color: '#333', margin: '0' },
  subtitle: { color: '#666', margin: '5px 0 0 0', fontSize: '14px' },
  filterSection: { background: 'white', padding: '15px', borderRadius: '12px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  filterTitle: { fontSize: '16px', margin: '0 0 10px 0', color: '#333' },
  filters: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  filterBtn: { padding: '10px 16px', border: 'none', borderRadius: '8px', background: '#eee', cursor: 'pointer', fontWeight: '600', fontSize: '14px', transition: 'all 0.2s' },
  filterActive: { background: '#6366f1', color: 'white', transform: 'scale(1.05)' },
  form: { background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  formTitle: { marginTop: '0', fontSize: '20px' },
  input: { width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' },
  formButtons: { display: 'flex', gap: '10px', marginTop: '15px' },
  saveBtn: { flex: 1, padding: '14px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' },
  cancelBtn: { flex: 1, padding: '14px', background: '#eee', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' },
  actionButtons: { display: 'flex', gap: '10px', marginBottom: '20px' },
  addBtn: { flex: 1, padding: '16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' },
  flashcardBtn: { flex: 1, padding: '16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(139,92,246,0.3)' },
  exportBtn: { padding: '16px 24px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' },
  wordsList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  wordCard: { background: 'white', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'transform 0.2s, box-shadow 0.2s' },
  wordHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' },
  cardWriting: { fontSize: '24px', fontWeight: 'bold', margin: '0' },
  editBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '5px', opacity: 0.6, transition: 'opacity 0.2s' },
  cardReading: { fontSize: '18px', color: '#6366f1', margin: '0 0 5px 0' },
  cardMeaning: { color: '#666', margin: '0 0 10px 0' },
  quickEdit: { marginBottom: '10px' },
  quickSelect: { padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', background: 'white', cursor: 'pointer', width: '100%', maxWidth: '200px' },
  cardTags: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  cardTag: { padding: '4px 10px', background: '#f3f4f6', borderRadius: '6px', fontSize: '12px', fontWeight: '600' },
  deleteBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '5px', transition: 'transform 0.2s', opacity: 0.6 },
  empty: { background: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#999' },
  
  // Paginación
  pagination: { 
    background: 'white', 
    padding: '20px', 
    borderRadius: '12px', 
    marginTop: '20px',
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
  },
  pageBtn: { 
    padding: '12px 24px', 
    background: '#6366f1', 
    color: 'white', 
    border: 'none', 
    borderRadius: '8px', 
    fontSize: '14px', 
    fontWeight: '600', 
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  pageBtnDisabled: { 
    background: '#e5e7eb', 
    color: '#9ca3af',
    cursor: 'not-allowed',
    opacity: 0.6 
  },
  pageInfo: { 
    textAlign: 'center',
    flex: 1,
    padding: '0 20px'
  },
  pageText: { 
    fontSize: '16px', 
    fontWeight: '600', 
    color: '#333',
    marginBottom: '4px'
  },
  pageSubtext: { 
    fontSize: '12px', 
    color: '#666' 
  },
  
  // Flashcard styles
  flashcardContainer: { maxWidth: '600px', margin: '0 auto', padding: '20px' },
  flashcardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  backButton: { background: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  counter: { color: 'white', fontSize: '18px', fontWeight: 'bold' },
  flashcard: { background: 'white', borderRadius: '20px', padding: '40px', minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
  completedCard: { background: 'white', borderRadius: '20px', padding: '60px 40px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
  languageTag: { background: '#f3f4f6', padding: '8px 16px', borderRadius: '20px', marginBottom: '20px', fontWeight: '600' },
  writing: { fontSize: '48px', fontWeight: 'bold', margin: '0 0 20px 0', textAlign: 'center' },
  answer: { textAlign: 'center', marginBottom: '20px' },
  reading: { fontSize: '28px', color: '#6366f1', margin: '0 0 10px 0', fontWeight: '600' },
  meaning: { fontSize: '20px', color: '#666', margin: '0 0 15px 0' },
  tags: { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' },
  tag: { padding: '6px 14px', background: '#f3f4f6', borderRadius: '8px', fontSize: '14px', fontWeight: '600' },
  revealButton: { background: '#6366f1', color: 'white', border: 'none', padding: '16px 32px', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '20px', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' },
  statusButtons: { display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap', justifyContent: 'center' },
  statusButton: { padding: '12px 20px', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '14px', minWidth: '120px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  navigation: { display: 'flex', justifyContent: 'space-between', marginTop: '20px', gap: '10px' },
  navButton: { background: 'white', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
};

ReactDOM.render(<App />, document.getElementById('root'));
