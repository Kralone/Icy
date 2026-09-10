import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CatalogService, CatalogEntry } from '../../../core/services/catalog/catalog.service';
import { CatalogCorrectionsComponent } from './catalog-corrections.component';

describe('Catalog corrections', () => {
 let component: CatalogCorrectionsComponent;
 let service: any;
 beforeEach(() => {
  service={associationCandidates:vi.fn(()=>of([{id:7,name:'Exact Red',family:'ITEM',imageUrl:'/red.webp',reason:'Nom exact'}])),saveAssociation:vi.fn(()=>of(undefined)),resetAssociation:vi.fn(()=>of(undefined)),correctionOffers:vi.fn(()=>of({items:[],page:0,totalElements:0})),saveImageCorrection:vi.fn(()=>of({id:1,name:'Exact',imageUrl:'/images/exact.webp',overrideImageUrl:'/images/exact.webp',fallbackImage:false})),resetImageCorrection:vi.fn(()=>of({id:1,name:'Exact',imageUrl:'/images/source.webp',overrideImageUrl:null,fallbackImage:false}))};
  TestBed.configureTestingModule({providers:[{provide:CatalogService,useValue:service}]});
  component=TestBed.runInInjectionContext(()=>new CatalogCorrectionsComponent());
 });
 it('never associates a proposal without explicit selection and validation',()=>{
  component.chooseOffer({id:3,name:'Exact Red',location:'Place',type:'BUY',price:20,currency:'aUEC',overrideEntryId:null,linkedName:null});
  expect(component.candidates).toHaveLength(1);
  expect(service.saveAssociation).not.toHaveBeenCalled();
  component.associate();expect(service.saveAssociation).not.toHaveBeenCalled();
  component.selectedCandidate=component.candidates[0];component.associate();
  expect(service.saveAssociation).toHaveBeenCalledExactlyOnceWith(3,7);
 });
 it('requires a successfully loaded preview of the current URL before saving',()=>{
  component.entry={id:1} as CatalogEntry;component.imageUrl='/images/exact.webp';
  component.saveImage();expect(service.saveImageCorrection).not.toHaveBeenCalled();
  component.preview();component.saveImage();expect(service.saveImageCorrection).not.toHaveBeenCalled();
  component.previewLoaded=true;component.saveImage();expect(service.saveImageCorrection).toHaveBeenCalledExactlyOnceWith(1,'/images/exact.webp');
 });
 it('keeps the chosen correction when saving fails and exposes the error',()=>{
  component.entry={id:1} as CatalogEntry;component.imageUrl='/images/exact.webp';component.preview();component.previewLoaded=true;
  service.saveImageCorrection.mockReturnValueOnce(throwError(()=>({status:500})));
  component.saveImage();expect(component.imageUrl).toBe('/images/exact.webp');expect(component.error).toBeTruthy();expect(component.busy).toBe(false);
 });
 it('resets explicitly to the source without requiring an image URL',()=>{
  component.entry={id:1} as CatalogEntry;component.saveImage(true);expect(service.resetImageCorrection).toHaveBeenCalledExactlyOnceWith(1);expect(component.image?.overrideImageUrl).toBeNull();
 });
});
