import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  QueryConstraint,
  DocumentData,
  WriteBatch,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

// ===== CREATE =====
export async function createDocument(collectionName: string, data: DocumentData) {
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✅ Document created in ${collectionName}/${docRef.id}`);
    return { id: docRef.id, ...data };
  } catch (error) {
    console.error('❌ Error creating document:', error);
    throw error;
  }
}

// ===== READ =====
export async function getDocument(collectionName: string, docId: string) {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log(`⚠️ Document not found: ${collectionName}/${docId}`);
      return null;
    }

    console.log(`✅ Document retrieved: ${collectionName}/${docId}`);
    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error('❌ Error retrieving document:', error);
    throw error;
  }
}

// Get all documents from a collection
export async function getAllDocuments(collectionName: string) {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const documents: any[] = [];

    querySnapshot.forEach(docSnap => {
      documents.push({ id: docSnap.id, ...docSnap.data() });
    });

    console.log(`✅ Retrieved ${documents.length} documents from ${collectionName}`);
    return documents;
  } catch (error) {
    console.error('❌ Error retrieving documents:', error);
    throw error;
  }
}

// Query documents with conditions
export async function queryDocuments(
  collectionName: string,
  constraints: QueryConstraint[]
) {
  try {
    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    const documents: any[] = [];

    querySnapshot.forEach(docSnap => {
      documents.push({ id: docSnap.id, ...docSnap.data() });
    });

    console.log(`✅ Query returned ${documents.length} documents from ${collectionName}`);
    return documents;
  } catch (error) {
    console.error('❌ Error querying documents:', error);
    throw error;
  }
}

// Convenience function for simple where query
export async function queryDocumentsByField(
  collectionName: string,
  field: string,
  operator: any,
  value: any
) {
  try {
    const q = query(collection(db, collectionName), where(field, operator, value));
    const querySnapshot = await getDocs(q);
    const documents: any[] = [];

    querySnapshot.forEach(docSnap => {
      documents.push({ id: docSnap.id, ...docSnap.data() });
    });

    console.log(
      `✅ Query returned ${documents.length} documents from ${collectionName}`
    );
    return documents;
  } catch (error) {
    console.error('❌ Error querying documents:', error);
    throw error;
  }
}

// ===== UPDATE =====
export async function updateDocument(
  collectionName: string,
  docId: string,
  data: DocumentData
) {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date(),
    });
    console.log(`✅ Document updated: ${collectionName}/${docId}`);
    return { id: docId, ...data };
  } catch (error) {
    console.error('❌ Error updating document:', error);
    throw error;
  }
}

// ===== UPSERT (Set with merge) =====
export async function upsertDocument(
  collectionName: string,
  docId: string,
  data: DocumentData
) {
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(
      docRef,
      {
        ...data,
        updatedAt: new Date(),
      },
      { merge: true }
    );
    console.log(`✅ Document upserted: ${collectionName}/${docId}`);
    return { id: docId, ...data };
  } catch (error) {
    console.error('❌ Error upserting document:', error);
    throw error;
  }
}

// ===== DELETE =====
export async function deleteDocument(collectionName: string, docId: string) {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    console.log(`✅ Document deleted: ${collectionName}/${docId}`);
    return { success: true, id: docId };
  } catch (error) {
    console.error('❌ Error deleting document:', error);
    throw error;
  }
}

// ===== BATCH OPERATIONS =====
export async function batchWrite(
  operations: {
    type: 'set' | 'update' | 'delete';
    collection: string;
    docId: string;
    data?: DocumentData;
  }[]
) {
  try {
    const batch: WriteBatch = writeBatch(db);

    operations.forEach(op => {
      const docRef = doc(db, op.collection, op.docId);

      if (op.type === 'set') {
        batch.set(docRef, op.data, { merge: true });
      } else if (op.type === 'update') {
        batch.update(docRef, op.data!);
      } else if (op.type === 'delete') {
        batch.delete(docRef);
      }
    });

    await batch.commit();
    console.log(`✅ Batch write completed: ${operations.length} operations`);
    return { success: true, operations: operations.length };
  } catch (error) {
    console.error('❌ Error in batch write:', error);
    throw error;
  }
}
