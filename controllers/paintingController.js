const { pool } = require('../database');
const openRouterService = require('../services/openRouterService');
const openAIService = require('../services/openAIService');
const { paintQueue } = require('../queue')

exports.generate = async (req, res) => {
  const { titleId, qty, instructions, refs } = req.body
  const ids = []

  for (let i = 0; i < qty; i++) {
    const [r] = await db.query(
      'insert into paintings (title_id, status) values (?, "queued")',
      [titleId]
    )
    ids.push(r.insertId)
    paintQueue.add('job', {
      paintingId: r.insertId,
      titleId,
      title: req.title,
      instructions,
      refs
    })
  }
  res.json({ paintingIds: ids })   // front-end shows placeholders immediately
}


// Generate painting ideas (parallel processing)
async function generatePaintings(req, res) {
  if (!req.user || !req.user.id) {
    console.error('User not authenticated properly');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { titleId, quantity = 5 } = req.body;
  const MAX_PARALLEL = 5;
  
  if (!titleId) {
    return res.status(400).json({ error: 'Title ID is required' });
  }
  
  try {
    // Get title info
    const titleParams = [titleId];
    if (titleParams.some(p => p === undefined)) {
      console.error('Attempted to execute query with undefined parameter:', { titleParams });
      return res.status(500).json({ error: 'Internal server error: Invalid query parameter detected' });
    }
    
    const [titleRows] = await pool.execute(
      'SELECT id, title, instructions FROM titles WHERE id = ?',
      titleParams
    );
    
    if (titleRows.length === 0) {
      return res.status(404).json({ error: 'Title not found' });
    }
    
    const title = titleRows[0];
    
    // Get reference images
    const refParams = [titleId, req.user.id];
    if (refParams.some(p => p === undefined)) {
      console.error('Attempted to execute query with undefined parameter:', { refParams });
      return res.status(500).json({ error: 'Internal server error: Invalid query parameter detected' });
    }
    
    const [refRows] = await pool.execute(
      'SELECT id, image_data FROM references2 WHERE title_id = ? OR (user_id = ? AND is_global = 1)',
      refParams
    );
    
    const references = refRows.map(row => ({ id: row.id, image_data: row.image_data }));
    
    // Get previous ideas for this title to avoid duplication
    const prevParams = [titleId];
    if (prevParams.some(p => p === undefined)) {
      console.error('Attempted to execute query with undefined parameter:', { prevParams });
      return res.status(500).json({ error: 'Internal server error: Invalid query parameter detected' });
    }
    
    const [prevIdeas] = await pool.execute(
      'SELECT id, summary FROM ideas WHERE title_id = ? ORDER BY created_at DESC',
      prevParams
    );
    
    // Generate ideas - first step (sequential)
    const newIdeas = [];
    for (let i = 0; i < quantity; i++) {
      const idea = await openRouterService.generateIdeas(
        titleId, 
        title.title, 
        title.instructions,
        [...prevIdeas, ...newIdeas] // Include previously generated ideas to avoid repetition
      );
      newIdeas.push(idea);
      
      // Create painting entry in processing state
      const paintingParams = [titleId, idea.id, 'pending'];
      if (paintingParams.some(p => p === undefined)) {
        console.error('Attempted to execute query with undefined parameter:', { paintingParams });
        return res.status(500).json({ error: 'Internal server error: Invalid query parameter detected' });
      }
      
      await pool.execute(
        'INSERT INTO paintings (title_id, idea_id, status) VALUES (?, ?, ?)',
        paintingParams
      );
    }
    
    // Start image generation in parallel (respecting MAX_PARALLEL limit)
    const processIdeas = async () => {
      const pendingIdeas = [...newIdeas];
      const activePromises = [];
      
      const startNextIdea = () => {
        if (pendingIdeas.length === 0) return;
        
        const idea = pendingIdeas.shift();
        const promise = openAIService.generateImage(idea.id, idea.fullPrompt, references)
          .catch(error => console.error(`Error generating image for idea ${idea.id}:`, error))
          .finally(() => {
            // When one finishes, start another if available
            const index = activePromises.indexOf(promise);
            if (index !== -1) activePromises.splice(index, 1);
            startNextIdea();
          });
        
        activePromises.push(promise);
      };
      
      // Start initial batch
      const initialBatch = Math.min(MAX_PARALLEL, pendingIdeas.length);
      for (let i = 0; i < initialBatch; i++) {
        startNextIdea();
      }
    };
    
    // Start processing in background
    processIdeas();
    
    // Return immediately with the generated ideas
    res.status(200).json({
      message: `Started generating ${quantity} paintings`,
      ideas: newIdeas
    });
  } catch (error) {
    console.error('Error in generatePaintings:', error);
    res.status(500).json({ error: 'Failed to generate paintings' });
  }
}

// Get status of all paintings for a title
async function getPaintings(req, res) {
  if (!req.user || !req.user.id) {
    console.error('User not authenticated properly');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { titleId } = req.params;
  const functionStartTime = Date.now(); 
  let stepStartTime = Date.now();

  if (!titleId) {
    return res.status(400).json({ error: 'Title ID is required' });
  }
  //console.log(`[Title ID: ${titleId}] getPaintings started.`);

  try {
    const titleCheckParams = [titleId];
    if (titleCheckParams.some(p => p === undefined)) {
      console.error('Attempted to execute query with undefined parameter:', { titleCheckParams });
      return res.status(500).json({ error: 'Internal server error: Invalid query parameter detected' });
    }
    
    const [titleCheck] = await pool.execute(
      'SELECT id FROM titles WHERE id = ?',
      titleCheckParams
    );
    if (titleCheck.length === 0) {
      console.warn(`[Title ID: ${titleId}] Title not found during initial check.`);
      return res.status(404).json({ error: 'Title not found' });
    }
    //console.log(`[Title ID: ${titleId}] Title existence check completed in ${Date.now() - stepStartTime}ms.`);
    stepStartTime = Date.now(); 
    
    const paintingQuery = `
      SELECT t.id, t.title_id, t.idea_id, t.image_url, t.status, t.created_at, t.error_message,
             t.used_reference_ids,
             i.summary, i.full_prompt as fullPrompt,
             titles.title as title_text, 
             titles.instructions as title_instructions
      FROM paintings t
      JOIN ideas i ON t.idea_id = i.id
      JOIN titles ON t.title_id = titles.id
      WHERE t.title_id = ?
      ORDER BY t.created_at DESC
    `;
    
    const paintingParams = [titleId];
    if (paintingParams.some(p => p === undefined)) {
      console.error('Attempted to execute query with undefined parameter:', { paintingParams });
      return res.status(500).json({ error: 'Internal server error: Invalid query parameter detected' });
    }
    
    const [paintingRows] = await pool.execute(paintingQuery, paintingParams);
    //console.log(`[Title ID: ${titleId}] Initial painting query fetched ${paintingRows ? paintingRows.length : 0} rows in ${Date.now() - stepStartTime}ms.`);
    stepStartTime = Date.now();

    if (!paintingRows || paintingRows.length === 0) {
      //console.log(`[Title ID: ${titleId}] No paintings found. Total time: ${Date.now() - functionStartTime}ms.`);
      return res.status(200).json({ paintings: [], referenceDataMap: {} }); // Return empty map
    }

    const allReferenceIds = new Set();
    paintingRows.forEach(row => {
      if (row.used_reference_ids) {
        try {
          const refIds = JSON.parse(row.used_reference_ids);
          if (refIds && Array.isArray(refIds)) {
            refIds.forEach(id => {
              if (id != null) allReferenceIds.add(id);
            });
          }
        } catch (e) {
          console.error(`[Title ID: ${titleId}] Error parsing used_reference_ids for painting ${row.id} (value: '${row.used_reference_ids}'):`, e.message);
        }
      }
    });
    //console.log(`[Title ID: ${titleId}] Collected ${allReferenceIds.size} unique reference IDs in ${Date.now() - stepStartTime}ms.`);
    stepStartTime = Date.now();

    let serverReferenceDataMap = {}; // Changed to object for JSON response
    const uniqueRefIdsArray = Array.from(allReferenceIds);

    if (uniqueRefIdsArray.length > 0) {
      try {
        const placeholders = uniqueRefIdsArray.map(() => '?').join(',');
        
        // Validate all parameters before executing query
        if (uniqueRefIdsArray.some(p => p === undefined)) {
          console.error('Attempted to execute query with undefined parameter in reference IDs:', { uniqueRefIdsArray });
          // Continue without reference data rather than failing the entire request
        } else {
          const [actualRefDataRows] = await pool.execute(
            `SELECT id, image_data FROM references2 WHERE id IN (${placeholders})`,
            uniqueRefIdsArray
          );
          actualRefDataRows.forEach(refRow => {
            serverReferenceDataMap[refRow.id] = refRow.image_data; // Populate object
          });
          //console.log(`[Title ID: ${titleId}] Bulk fetched ${Object.keys(serverReferenceDataMap).length} reference data items in ${Date.now() - stepStartTime}ms.`);
        }
      } catch (refQueryError) {
          console.error(`[Title ID: ${titleId}] Error fetching bulk reference data:`, refQueryError);
          //console.log(`[Title ID: ${titleId}] Proceeding without detailed reference images due to bulk fetch error. Time before error: ${Date.now() - stepStartTime}ms.`);
      }
    }
    stepStartTime = Date.now();

    const paintingsWithDetails = paintingRows.map(row => {
      let usedRefIdsList = [];
      let referenceCount = 0;

      if (row.used_reference_ids) {
        try {
          const refIds = JSON.parse(row.used_reference_ids);
          if (refIds && Array.isArray(refIds) && refIds.length > 0) {
            usedRefIdsList = refIds.filter(id => id != null && serverReferenceDataMap.hasOwnProperty(id));
            referenceCount = usedRefIdsList.length;
          }
        } catch (e) { /* Error already logged */ }
      }
      
      const promptDetails = {
        summary: row.summary || '',
        title: row.title_text || 'Unknown Title',
        instructions: row.title_instructions || 'No custom instructions provided',
        referenceCount: referenceCount,
        referenceImages: usedRefIdsList, // Now an array of IDs
        fullPrompt: row.fullPrompt || ''
      };


        
      // console.log({
      //   id: row.id,
      //   idea_id: row.idea_id,
      //   title_id: row.title_id,
      //   image_url: row.image_url || '',
      //   status: row.status || 'unknown',
      //   created_at: row.created_at || new Date(),
      //   error_message: row.error_message || '',
      //   summary: row.summary || '',
      //   promptDetails: promptDetails
      // }); 


           return {
        id: row.id,
        idea_id: row.idea_id,
        title_id: row.title_id,
        image_url: row.image_url || '',
        status: row.status || 'unknown',
        created_at: row.created_at || new Date(),
        error_message: row.error_message || '',
        summary: row.summary || '',
        promptDetails: promptDetails
      };
    });
    //console.log(`[Title ID: ${titleId}] Mapped paintings to details in ${Date.now() - stepStartTime}ms.`);
    
    //console.log(`[Title ID: ${titleId}] getPaintings completed successfully in ${Date.now() - functionStartTime}ms.`);
    res.status(200).json({ paintings: paintingsWithDetails, referenceDataMap: serverReferenceDataMap });

  } catch (error) {
    console.error(`[Title ID: ${titleId}] Critical error in getPaintings (total time: ${Date.now() - functionStartTime}ms):`, error);
    res.status(500).json({ error: `Failed to get paintings: ${error.message}` });
  }
}

// async function regenerateImage(req, res) {
//   console.log('Regenerate image request received:', JSON.stringify(req.body.paintingId), (req.user ? `for user ${req.user.id}` : ''));
//   if (!req.user || !req.user.id) {
//     console.error('User not authenticated properly');
//     return res.status(401).json({ error: 'Authentication required' });
//   }

//   const { paintingId } = req.body;

//   if (!paintingId) {
//     return res.status(400).json({ error: 'Painting ID is required' });
//   }

//   try {
//     const [paintingRows] = await pool.execute(
//       'SELECT p.id, p.idea_id, i.full_prompt, t.title, t.instructions FROM paintings p JOIN ideas i ON p.idea_id = i.id JOIN titles t ON p.title_id = t.id WHERE p.id = ?',
//       [paintingId]
//     );

//     if (paintingRows.length === 0) {
//       return res.status(404).json({ error: 'Painting not found' });
//     }

//     const painting = paintingRows[0];

//     const [refRows] = await pool.execute(
//       'SELECT id, image_data FROM references2 WHERE title_id = (SELECT title_id FROM paintings WHERE id = ?) OR (user_id = ? AND is_global = 1)',
//       [paintingId, req.user.id]
//     );

//     const references = refRows.map(row => ({ id: row.id, image_data: row.image_data }));

//     await pool.execute(
//       'UPDATE paintings SET status = ?, error_message = NULL WHERE id = ?',
//       ['pending', paintingId]
//     );

//     openAIService.generateImage(painting.idea_id, painting.full_prompt, references)
//       .catch(error => console.error(`Error regenerating image for painting ${paintingId}:`, error));

//     res.status(200).json({ message: 'Regeneration initiated successfully', paintingId });
//   } catch (error) {
//     console.error('Error in regenerateImage:', error);
//     res.status(500).json({ error: 'Failed to initiate regeneration' });
//   }
// }
async function regenerateImage(req, res) {
  const { paintingId, skip = false } = req.body;
  console.log('Regenerate image request received:', { paintingId, skip, user: req.user?.id });

  if (!req.user || !req.user.id) {
    console.error('User not authenticated properly');
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!paintingId) {
    return res.status(400).json({ error: 'Painting ID is required' });
  }

  try {
    if (false) {

      //Wrote to skip real regeneration
      // Assign default image instantly
      const defaultUrl = '/uploads/default.png';
      await pool.execute(
        'UPDATE paintings SET image_url = ?, status = ?, error_message = NULL WHERE id = ?',
        [defaultUrl, 'completed', paintingId]
      );
      console.log(`Skipped real regeneration, assigned default image for painting ${paintingId}`);
      return res.status(200).json({ message: 'Default image assigned', paintingId, image_url: defaultUrl });
    }

    const [rows] = await pool.execute(
      'SELECT p.id, p.idea_id, i.full_prompt, t.title, t.instructions \n       FROM paintings p \n       JOIN ideas i ON p.idea_id = i.id \n       JOIN titles t ON p.title_id = t.id \n       WHERE p.id = ?',
      [paintingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Painting not found' });
    }
    const painting = rows[0];

    const [refRows] = await pool.execute(
      'SELECT id, image_data FROM references2 \n       WHERE title_id = (SELECT title_id FROM paintings WHERE id = ?) \n         OR (user_id = ? AND is_global = 1)',
      [paintingId, req.user.id]
    );
    const references = refRows.map(r => ({ id: r.id, image_data: r.image_data }));

    // Mark as pending and clear previous errors
    await pool.execute(
      'UPDATE paintings SET status = ?, error_message = NULL WHERE id = ?',
      ['pending', paintingId]
    );

    openAIService.generateImage(painting.idea_id, painting.full_prompt, references)
      .catch(err => console.error(`Error generating image for painting ${paintingId}:`, err));

    res.status(200).json({ message: 'Regeneration initiated', paintingId });
  } catch (error) {
    console.error('Error in regenerateImage:', error);
    res.status(500).json({ error: 'Failed to initiate regeneration' });
  }
}

module.exports = {
  generatePaintings,
  getPaintings,
  regenerateImage
}; 