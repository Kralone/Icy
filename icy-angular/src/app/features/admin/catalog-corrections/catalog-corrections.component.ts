import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';
import { CatalogService, CatalogEntry, CatalogImageCorrection, CorrectionOfferPage, UnassociatedOffer, AssociationCandidate } from '../../../core/services/catalog/catalog.service';

@Component({selector: 'app-catalog-corrections', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './catalog-corrections.component.html', styleUrl: './catalog-corrections.component.css', changeDetection: ChangeDetectionStrategy.Eager})
export class CatalogCorrectionsComponent implements OnInit, OnDestroy {
  @Input() entry: CatalogEntry | null = null;
  @Output() imageChanged = new EventEmitter<CatalogImageCorrection>();
  readonly service = inject(CatalogService);
  image: CatalogImageCorrection | null = null;
  imageUrl = ''; previewUrl = ''; previewFailed = false; previewLoaded = false;
  offers: CorrectionOfferPage | null = null;
  corrected = false; query = ''; page = 0; loading = false; busy = false; error = ''; success = '';
  selectedOffer: UnassociatedOffer | null = null; candidates: AssociationCandidate[] = []; candidateQuery = ''; candidateLoading = false; candidateError = ''; selectedCandidate: AssociationCandidate | null = null;
  private requests = new Subscription(); private candidateRequest?: Subscription; private listRequest?: Subscription;
  ngOnInit(): void { if(this.entry) this.loadImage(); else this.loadOffers(); }
  ngOnDestroy(): void { this.requests.unsubscribe(); this.candidateRequest?.unsubscribe(); this.listRequest?.unsubscribe(); }
  private failure(error: any): void { this.error = error?.status === 403 ? 'Corrections réservées aux administrateurs.' : 'La modification ou le chargement a échoué. Réessayez.'; }
  loadImage(): void {
    if(!this.entry) return; this.loading=true; this.error='';
    this.requests.add(this.service.imageCorrection(this.entry.id).pipe(finalize(()=>this.loading=false)).subscribe({next: image=>{this.image=image;this.imageUrl=image.overrideImageUrl??'';},error:e=>this.failure(e)}));
  }
  preview(): void { this.previewUrl=this.imageUrl.trim(); this.previewFailed=false; this.previewLoaded=false; }
  saveImage(reset=false): void {
    if(!this.entry || this.busy || (!reset && (!this.validImageUrl || this.previewUrl!==this.imageUrl.trim() || this.previewFailed || !this.previewLoaded))) return;
    this.busy=true;this.error='';this.success='';
    const request=reset?this.service.resetImageCorrection(this.entry.id):this.service.saveImageCorrection(this.entry.id,this.imageUrl.trim());
    this.requests.add(request.pipe(finalize(()=>this.busy=false)).subscribe({next:image=>{this.image=image;this.imageUrl=image.overrideImageUrl??'';this.previewUrl='';this.success=reset?'Image source rétablie.':'Image enregistrée pour cette fiche.';this.imageChanged.emit(image);},error:e=>this.failure(e)}));
  }
  get validImageUrl(): boolean { const url=this.imageUrl.trim();return url.length<=2048 && (/^https:\/\/[^/\s]+\//i.test(url) || /^\/(images|assets)\//.test(url)) && !url.includes('..'); }
  loadOffers(page=0): void {
    this.listRequest?.unsubscribe();this.candidateRequest?.unsubscribe();this.loading=true;this.error='';this.page=page;this.selectedOffer=null;this.selectedCandidate=null;
    this.listRequest=this.service.correctionOffers(this.corrected,this.query,page).pipe(finalize(()=>this.loading=false)).subscribe({next:result=>this.offers=result,error:e=>this.failure(e)});
  }
  chooseOffer(offer: UnassociatedOffer): void { this.selectedOffer=offer;this.candidateQuery='';this.findCandidates(); }
  findCandidates(): void {
    if(!this.selectedOffer) return;this.candidateRequest?.unsubscribe();this.candidateLoading=true;this.candidateError='';this.candidates=[];this.selectedCandidate=null;
    this.candidateRequest=this.service.associationCandidates(this.selectedOffer.id,this.candidateQuery).pipe(finalize(()=>this.candidateLoading=false)).subscribe({next:rows=>this.candidates=rows,error:()=>this.candidateError='Impossible de charger les propositions.'});
  }
  associate(reset=false): void {
    if(!this.selectedOffer || this.busy || (!reset&&!this.selectedCandidate))return;
    this.busy=true;this.error='';this.success='';
    const request=reset?this.service.resetAssociation(this.selectedOffer.id):this.service.saveAssociation(this.selectedOffer.id,this.selectedCandidate!.id);
    this.requests.add(request.pipe(finalize(()=>this.busy=false)).subscribe({next:()=>{this.success=reset?'Association source rétablie.':'Association enregistrée pour cette offre.';this.loadOffers(this.page);},error:e=>this.failure(e)}));
  }
}
