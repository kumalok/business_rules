(function() {
	var Ext = window.Ext4 || window.Ext;

	Ext.define('Rally.apps.releasetracking.statsbanner.popover.Defects', {
		alias: 'widget.defectspopover',
		extend: 'Rally.ui.popover.Popover',

		constructor: function (config) {
			config.items = [
				{
					xtype: 'rallygrid',
					model: 'User Story',
					headerCls: 'leftright-header-text',
					columnCfgs: ['FormattedID', 'Name', config.lowestLevelPi, 'Plan Estimate', 'Iteration', 'Release', 'Project', 'Owner'],
					pagingToolbarCfg: {
						pageSizes: [5, 10, 15]
					},
					store: config.store
				}
			];

			this.callParent(arguments);
		}
	});
	/**
     * shows defects active for timebox
     */
	Ext.define('Rally.apps.releasetracking.statsbanner.Defects', {
		extend: 'Rally.apps.releasetracking.statsbanner.BannerWidget',
		alias:'widget.statsbannerdefects',
		requires: [],

		config: {
			context: null,
			store: null,
			lowestLevelPi: 'portfolioitem/feature',
			data: {
				activeCount: 0
			}
		},

		tpl: [
			'<div class="expanded-widget">',
			'<span style="cursor: pointer">',
			'<div class="stat-title">Defect Count</div>',
			'<div class="stat-metric late">',
			'<div class="metric-icon icon-story"></div>{activeCount}',
			'<div class="stat-secondary">Active</div>',
			'</span>',
			'</div>',
			'</div>',
			'<div class="collapsed-widget">',
			'<span class="metric-icon icon-story"></span>',
			'<div class="stat-title">Active Defect Count</div>',
			'<div class="stat-metric">{activeCount}</div>',
			'</div>'
		],

		initComponent: function() {
			this.callParent(arguments);

			if (this._storyStates === undefined) {
				Rally.data.ModelFactory.getModels({
					types: ['UserStory'],
					context: this.getContext(),
					scope: this,
					requester: this,
					success: function(models){
						models.UserStory.getField('ScheduleState').getAllowedValueStore().load({
							callback: this._createStateMap,
							requester: this,
							scope: this
						});
					}
				});
			} else {
				this._loadArtifacts();
			}
		},

		_createStateMap: function(allowedValues) {
			var stateMap = ['Defined', 'In-Progress', 'Completed'],
				stateMapIndex = 0,
				storyStates = {};

			_.each(allowedValues, function(value) {
				var state = value.data.StringValue;
				if (state) {
					if (state === stateMap[stateMapIndex + 1]) {
						stateMapIndex++;
					}
					storyStates[state] = stateMap[stateMapIndex];
				}
			});

			this._storyStates = storyStates;
			this._loadArtifacts();
		},

		_loadArtifacts: function() {
			this._chartData = [];
			this._childChartData = [];

			this.store = Ext.create('Rally.data.wsapi.artifact.Store', {
				models: [this.lowestLevelPi],
				fetch: ['UserStories', 'PreliminaryEstimate', 'Value', 'FormattedID', 'State[Ordinal;Name]', 'LeafStoryCount', 'Name',
					'PlannedEndDate', 'PlannedStartDate', 'ActualStartDate', 'ActualEndDate', 'PercentDoneByStoryPlanEstimate', 'PercentDoneByStoryCount'],
				filters: [this.context.getTimeboxScope().getQueryFilter()],
				context: this.context.getDataContext(),
				limit: Infinity,
				requester: this,
				autoLoad: true,
				listeners: {
					load: this._loadChildCollections,
					scope: this
				}
			});
		},

		_loadChildCollections: function() {
			var records = this.store.getRange();
			var promises = [];
			var piField = this.lowestLevelPi.split('/')[1];
			_.each(records, function(record) {
				if (record.get('UserStories') && record.get('UserStories').Count) {
					var store = Ext.create('Rally.data.wsapi.Store', {
						model: 'UserStory',
						fetch: ['FormattedID', 'Name', 'ScheduleState', 'Blocked', 'BlockedReason', 'Defects', piField],
						filters: [{
							property: piField,
							value: record.get('_ref')
						}, {
							property: 'DirectChildrenCount',
							value: 0
						}]
					});
					promises.push(store.load({
						requester: this,
						callback: function(stories) {
							record.get('UserStories').Results = stories;
						}
					}));
				}
			});

			if (promises.length > 0) {
				Deft.Promise.all(promises).then({
					success: this.onDataChanged,
					scope: this
				});
			} else {
				this.onDataChanged();
			}
		},
		/*initComponent: function() {
			this.mon(this.store, 'datachanged', this.onDataChanged, this);
			this.on('render', function () {
				this.getEl().on('click', function () {
					this._onClickLateStories();
				}, this);
			}, this);
			this.callParent(arguments);
		},*/

		onDataChanged: function() {
			this.update(this._getRenderData());
			this.fireEvent('ready', this);
		},

		_getActiveDefectsCount: function() {
			var activeDefectsCount = 0;
			
			_.each(this.store.getRange(), function(record){
				var stories = record.get('UserStories');
				if (stories && stories.Results) {
					_.each(stories.Results, function(story) {
						console.log('Story: ', story);
						console.log('Defects: ', story.Defects);
						_.each(story.Defects.State, function(state, count) {
							if (state !== 'Closed') {
								activeDefectsCount += count;
							}
						});
					}, this);
				}
				//lateStories += record.get('LateChildCount');
			}, this);
			return activeDefectsCount;
		},

		_getRenderData: function() {
			return {activeCount: this._getActiveDefectsCount()};
		},

		_onClickLateStories: function() {
			var record = this.store.getAt(0);
			var
				filters = this._filterPopover(record.data),
				target = this.getEl();
			var store = Ext.create('Rally.data.wsapi.Store', {
				model: 'UserStory',
				fetch: ['FormattedID', 'Name', this._getLowestLevelPIFieldName(), 'Release', 'Iteration', 'Project', 'Owner'],
				filters: filters,
				autoLoad: true,
				pageSize: 5
			});

			var reloadStoreCallback;
			Ext.create('Rally.apps.releasetracking.statsbanner.popover.Defects', {
				target: target,
				autoShow: false,
				record: record,
				//filters: filters,
				store: store,
				title: 'User Stories Assigned to Later Releases or Iteration',
				width: 800,
				lowestLevelPi: this._getLowestLevelPIFieldName()
			}).show();
		},

		_getLowestLevelPIFieldName: function() {
			return this.lowestLevelPi.split('/')[1];
		},

		_filterPopover: function(record) {
			return [
				{
					property: this._getLowestLevelPIFieldName() + '.Release.Name',
					operator: '=',
					value: record.Release.Name
				},
				{
					property: 'DirectChildrenCount',
					operator: '=',
					value: 0
				},
				Rally.data.wsapi.Filter.or([
					{
						property: 'Iteration.EndDate',
						operator: '>',
						value: record.Release.ReleaseDate
					},
					{
						property: 'Release.ReleaseDate',
						operator: '>',
						value: record.Release.ReleaseDate
					}
				])
			];
		}
	});
})();
